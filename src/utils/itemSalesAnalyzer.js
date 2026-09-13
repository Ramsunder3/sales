/**
 * itemSalesAnalyzer.js
 * Analyzes previous bills to compute live item-by-item sales metrics,
 * revenue, order frequency, stock depletion, and transaction logs.
 */

// Helper to normalize strings for robust matching
export const normalizeStr = (str) => (str || '').trim().toUpperCase();

/**
 * Robustly match a bill line-item against the catalog of products.
 */
export const findMatchingProduct = (products, billItem) => {
  if (!products || !billItem) return null;

  return products.find(p => {
    // 1. Direct ID match
    if (p.id && billItem.productId && p.id === billItem.productId) return true;
    
    // 2. Serial number match
    if (p.srNo !== undefined && billItem.productId !== undefined && String(p.srNo) === String(billItem.productId)) return true;

    // 3. Exact Name + Weight match
    const nameMatch = normalizeStr(p.name) === normalizeStr(billItem.name);
    const weightMatch = normalizeStr(p.weight) === normalizeStr(billItem.weight);
    if (nameMatch && weightMatch) return true;

    // 4. Name match fallback (if weight missing or identical)
    if (nameMatch && (!billItem.weight || !p.weight)) return true;

    return false;
  });
};

/**
 * Filter bills according to a date range.
 */
export const filterBillsByDate = (bills, dateRange = 'all', customDate = null) => {
  if (!bills || !Array.isArray(bills)) return [];

  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayStr = new Date(Date.now() - 86400000).toDateString();

  return bills.filter(b => {
    if (!b.dateTime) return true;
    const billDate = new Date(b.dateTime);
    const billDateStr = billDate.toDateString();

    if (dateRange === 'today') {
      return billDateStr === todayStr;
    }
    if (dateRange === 'yesterday') {
      return billDateStr === yesterdayStr;
    }
    if (dateRange === 'custom' && customDate) {
      const customDateStr = new Date(customDate).toDateString();
      return billDateStr === customDateStr;
    }
    return true;
  });
};

/**
 * Main analyzer function: extracts live item sales metrics by scanning all previous bills.
 */
export const analyzeItemSales = (bills = [], products = [], options = {}) => {
  const {
    dateRange = 'all',
    customDate = null,
    includeVoid = false,
    searchQuery = '',
    selectedCategory = 'All',
    salesStatusFilter = 'all',
    sortBy = 'qty_desc'
  } = options;

  // Filter bills by void status and date
  const candidateBills = bills.filter(b => includeVoid ? true : b.status !== 'void');
  const activeBills = filterBillsByDate(candidateBills, dateRange, customDate);

  // Map to hold aggregated metrics keyed by product ID (or generated key)
  const itemMap = new Map();

  // 1. Initialize map with existing products from catalog
  products.forEach(p => {
    const key = p.id || `PROD-${p.srNo}`;
    itemMap.set(key, {
      id: p.id || key,
      srNo: p.srNo || 0,
      name: p.name || 'Unnamed Item',
      brand: p.brand || 'Other',
      weight: p.weight || '-',
      mrp: parseFloat(p.mrp) || 0,
      openingQty: parseInt(p.openingQty, 10) || 0,
      alreadySoldYesterday: parseInt(p.alreadySoldYesterday, 10) || 0,
      currentStock: parseInt(p.currentStock, 10) || 0,
      needsQtySetup: !!p.needsQtySetup,
      needsPriceSetup: !!p.needsPriceSetup,
      
      // Metrics to compute from bills
      billsSoldQty: 0,
      totalSoldQty: dateRange === 'all' || dateRange === 'yesterday' ? (parseInt(p.alreadySoldYesterday, 10) || 0) : 0,
      billsRevenue: 0,
      totalRevenue: dateRange === 'all' || dateRange === 'yesterday' ? ((parseInt(p.alreadySoldYesterday, 10) || 0) * (parseFloat(p.mrp) || 0)) : 0,
      billCount: 0,
      lastSoldDateTime: null,
      lastSoldBillNo: null,
      lastCustomer: null,
      billsHistory: [],
      paymentSplit: {
        Cash: { qty: 0, amount: 0 },
        UPI: { qty: 0, amount: 0 },
        Card: { qty: 0, amount: 0 }
      },
      hourlySales: {},
      isFromCatalog: true
    });
  });

  // 2. Iterate through all active bills and analyze each sold item
  activeBills.forEach(bill => {
    if (!bill.items || !Array.isArray(bill.items)) return;

    bill.items.forEach(lineItem => {
      const qty = parseInt(lineItem.qty, 10) || 0;
      const rate = parseFloat(lineItem.rate) || 0;
      const amount = parseFloat(lineItem.amount) || (qty * rate);
      const paymentMode = bill.paymentMode || 'Cash';

      // Find matching product in catalog
      const matched = findMatchingProduct(products, lineItem);
      let itemKey = matched ? (matched.id || `PROD-${matched.srNo}`) : null;

      if (!itemKey) {
        // Line item exists in previous bills but not in active catalog
        itemKey = `EXTRA-${normalizeStr(lineItem.name)}-${normalizeStr(lineItem.weight)}`;
        if (!itemMap.has(itemKey)) {
          itemMap.set(itemKey, {
            id: lineItem.productId || itemKey,
            srNo: products.length + itemMap.size + 1,
            name: lineItem.name || 'Unknown Item',
            brand: lineItem.brand || 'Other',
            weight: lineItem.weight || '-',
            mrp: rate,
            openingQty: 0,
            alreadySoldYesterday: 0,
            currentStock: 0,
            needsQtySetup: false,
            needsPriceSetup: false,
            billsSoldQty: 0,
            totalSoldQty: 0,
            billsRevenue: 0,
            totalRevenue: 0,
            billCount: 0,
            lastSoldDateTime: null,
            lastSoldBillNo: null,
            lastCustomer: null,
            billsHistory: [],
            paymentSplit: {
              Cash: { qty: 0, amount: 0 },
              UPI: { qty: 0, amount: 0 },
              Card: { qty: 0, amount: 0 }
            },
            hourlySales: {},
            isFromCatalog: false
          });
        }
      }

      const itemStats = itemMap.get(itemKey);
      if (itemStats) {
        itemStats.billsSoldQty += qty;
        itemStats.totalSoldQty += qty;
        itemStats.billsRevenue += amount;
        itemStats.totalRevenue += amount;
        itemStats.billCount += 1;

        // Track last sale time
        if (!itemStats.lastSoldDateTime || new Date(bill.dateTime) > new Date(itemStats.lastSoldDateTime)) {
          itemStats.lastSoldDateTime = bill.dateTime;
          itemStats.lastSoldBillNo = bill.billNo;
          itemStats.lastCustomer = bill.customerName || bill.customerPhone || null;
        }

        // Add to bills history list
        itemStats.billsHistory.push({
          billNo: bill.billNo,
          dateTime: bill.dateTime,
          customerName: bill.customerName || 'Walk-in Customer',
          customerPhone: bill.customerPhone || '',
          paymentMode: bill.paymentMode || 'Cash',
          qty,
          rate,
          amount,
          billGrandTotal: bill.grandTotal,
          billStatus: bill.status || 'active'
        });

        // Payment mode breakdown
        const safeMode = ['Cash', 'UPI', 'Card'].includes(paymentMode) ? paymentMode : 'Cash';
        itemStats.paymentSplit[safeMode].qty += qty;
        itemStats.paymentSplit[safeMode].amount += amount;

        // Hourly distribution
        if (bill.dateTime) {
          const hour = new Date(bill.dateTime).getHours();
          const hourKey = `${String(hour).padStart(2, '0')}:00`;
          itemStats.hourlySales[hourKey] = (itemStats.hourlySales[hourKey] || 0) + qty;
        }
      }
    });
  });

  // 3. Process computed fields & depletion rates
  let itemsList = Array.from(itemMap.values()).map(item => {
    // Sort bills history descending by date
    item.billsHistory.sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

    const opening = item.openingQty || (item.totalSoldQty + item.currentStock) || 0;
    const depletionPercent = opening > 0 ? Math.min(100, Math.round((item.totalSoldQty / opening) * 100)) : 0;
    
    // Determine sales velocity status
    let salesStatus = 'no_sales';
    if (item.currentStock <= 0 && item.isFromCatalog) {
      salesStatus = 'out_of_stock';
    } else if (item.currentStock > 0 && item.currentStock <= 5) {
      salesStatus = 'low_stock';
    } else if (item.totalSoldQty >= 15 || depletionPercent >= 50) {
      salesStatus = 'fast_selling';
    } else if (item.totalSoldQty > 0) {
      salesStatus = 'active';
    }

    return {
      ...item,
      effectiveOpening: opening,
      depletionPercent,
      salesStatus,
      avgQtyPerOrder: item.billCount > 0 ? (item.billsSoldQty / item.billCount).toFixed(1) : '0'
    };
  });

  // 4. Filtering
  if (selectedCategory && selectedCategory !== 'All') {
    itemsList = itemsList.filter(item => item.brand === selectedCategory);
  }

  if (salesStatusFilter && salesStatusFilter !== 'all') {
    itemsList = itemsList.filter(item => {
      if (salesStatusFilter === 'sold') return item.totalSoldQty > 0;
      if (salesStatusFilter === 'unsold') return item.totalSoldQty === 0;
      if (salesStatusFilter === 'fast') return item.salesStatus === 'fast_selling';
      if (salesStatusFilter === 'low_stock') return item.salesStatus === 'low_stock';
      if (salesStatusFilter === 'out_of_stock') return item.salesStatus === 'out_of_stock';
      return true;
    });
  }

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    itemsList = itemsList.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.weight.toLowerCase().includes(q) ||
      String(item.srNo) === q ||
      (item.lastSoldBillNo && item.lastSoldBillNo.toLowerCase().includes(q))
    );
  }

  // 5. Sorting
  itemsList.sort((a, b) => {
    if (sortBy === 'qty_desc') return b.totalSoldQty - a.totalSoldQty;
    if (sortBy === 'qty_asc') return a.totalSoldQty - b.totalSoldQty;
    if (sortBy === 'revenue_desc') return b.totalRevenue - a.totalRevenue;
    if (sortBy === 'revenue_asc') return a.totalRevenue - b.totalRevenue;
    if (sortBy === 'orders_desc') return b.billCount - a.billCount;
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'stock_asc') return a.currentStock - b.currentStock;
    if (sortBy === 'recent') {
      const timeA = a.lastSoldDateTime ? new Date(a.lastSoldDateTime).getTime() : 0;
      const timeB = b.lastSoldDateTime ? new Date(b.lastSoldDateTime).getTime() : 0;
      return timeB - timeA;
    }
    return b.totalSoldQty - a.totalSoldQty;
  });

  return {
    items: itemsList,
    totalBillsAnalyzed: activeBills.length,
    activeBills
  };
};

/**
 * Returns a live flat feed of individual items sold across all bills,
 * in reverse chronological order (newest transaction first).
 */
export const getLiveItemSalesFeed = (bills = [], limit = 100) => {
  if (!bills || !Array.isArray(bills)) return [];

  const feed = [];
  
  const activeBills = bills
    .filter(b => b.status !== 'void')
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime));

  activeBills.forEach(bill => {
    if (!bill.items || !Array.isArray(bill.items)) return;

    bill.items.forEach((item, itemIdx) => {
      feed.push({
        id: `${bill.billNo}-${item.productId || itemIdx}-${bill.dateTime}`,
        billNo: bill.billNo,
        dateTime: bill.dateTime,
        customerName: bill.customerName || 'Walk-in Customer',
        customerPhone: bill.customerPhone || '',
        paymentMode: bill.paymentMode || 'Cash',
        productId: item.productId,
        name: item.name,
        brand: item.brand,
        weight: item.weight,
        qty: parseInt(item.qty, 10) || 0,
        rate: parseFloat(item.rate) || 0,
        amount: parseFloat(item.amount) || ((parseInt(item.qty, 10) || 0) * (parseFloat(item.rate) || 0))
      });
    });
  });

  return feed.slice(0, limit);
};

/**
 * Generates overall KPI metrics from the analyzed items list.
 */
export const getItemSalesSummaryStats = (analyzedItems = [], totalBillsCount = 0) => {
  let totalUnitsSold = 0;
  let totalRevenue = 0;
  let productsWithSalesCount = 0;
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let fastMovingCount = 0;

  analyzedItems.forEach(item => {
    totalUnitsSold += item.totalSoldQty;
    totalRevenue += item.totalRevenue;
    if (item.totalSoldQty > 0) productsWithSalesCount += 1;
    if (item.currentStock <= 0) outOfStockCount += 1;
    if (item.currentStock > 0 && item.currentStock <= 5) lowStockCount += 1;
    if (item.salesStatus === 'fast_selling') fastMovingCount += 1;
  });

  const topSellingByQty = [...analyzedItems]
    .filter(i => i.totalSoldQty > 0)
    .sort((a, b) => b.totalSoldQty - a.totalSoldQty)
    .slice(0, 5);

  const topSellingByRevenue = [...analyzedItems]
    .filter(i => i.totalRevenue > 0)
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  return {
    totalUnitsSold,
    totalRevenue,
    totalProducts: analyzedItems.length,
    productsWithSalesCount,
    unsoldProductsCount: Math.max(0, analyzedItems.length - productsWithSalesCount),
    totalBillsCount,
    outOfStockCount,
    lowStockCount,
    fastMovingCount,
    topSellingByQty,
    topSellingByRevenue
  };
};

/**
 * Format relative time (e.g. 'Just now', '5 mins ago', '10:30 AM')
 */
export const formatTimeAgo = (isoDate) => {
  if (!isoDate) return 'No sales recorded';

  const date = new Date(isoDate);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins} min${mins > 1 ? 's' : ''} ago`;
  }
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  return `${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};
