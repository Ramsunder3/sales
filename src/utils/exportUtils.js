export const exportToCSV = (filename, rows) => {
  const csvContent = 'data:text/csv;charset=utf-8,' 
    + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportProductsCSV = (products) => {
  const headers = ['Sr No', 'Product Name', 'Brand', 'Weight', 'MRP (₹)', 'Opening Qty', 'Sold Yesterday', 'Current Stock', 'Status'];
  const dataRows = products.map(p => [
    p.srNo,
    p.name,
    p.brand,
    p.weight,
    p.mrp,
    p.openingQty,
    p.alreadySoldYesterday,
    p.currentStock,
    p.needsQtySetup || p.needsPriceSetup ? 'Pending Admin Review' : p.currentStock <= 0 ? 'Out of Stock' : p.currentStock <= 5 ? 'Low Stock' : 'In Stock'
  ]);

  const timestamp = new Date().toISOString().slice(0, 10);
  exportToCSV(`KRLConsolidates_Inventory_${timestamp}.csv`, [headers, ...dataRows]);
};

export const exportBillsCSV = (bills) => {
  const headers = ['Bill No', 'Date', 'Time', 'Customer Name', 'Customer Phone', 'Payment Mode', 'Items Count', 'Items Detail', 'Subtotal (₹)', 'Discount (₹)', 'Grand Total (₹)', 'Status'];
  
  const dataRows = bills.map(b => {
    const d = new Date(b.dateTime);
    const dateStr = d.toLocaleDateString('en-IN');
    const timeStr = d.toLocaleTimeString('en-IN');
    const itemsDetailStr = b.items.map(i => `${i.name} (${i.weight}) x${i.qty} @ ₹${i.rate}`).join(' | ');

    return [
      b.billNo,
      dateStr,
      timeStr,
      b.customerName || 'N/A',
      b.customerPhone || 'N/A',
      b.paymentMode,
      b.items.reduce((acc, curr) => acc + curr.qty, 0),
      itemsDetailStr,
      b.subtotal || b.grandTotal + (b.discount || 0),
      b.discount || 0,
      b.grandTotal,
      b.status || 'Active'
    ];
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  exportToCSV(`KRLConsolidates_SalesLog_${timestamp}.csv`, [headers, ...dataRows]);
};

export const exportItemSalesCSV = (analyzedItems, dateRange = 'All Time') => {
  const headers = [
    'Sr No',
    'Product Name',
    'Brand',
    'Weight',
    'MRP (₹)',
    'Opening Qty',
    'Units Sold From Bills',
    'Total Sold Qty',
    'Total Revenue (₹)',
    'Bill Count',
    'Avg Qty / Bill',
    'Cash Sold (₹)',
    'UPI Sold (₹)',
    'Card Sold (₹)',
    'Last Sold Time',
    'Last Sold Bill No',
    'Current Stock',
    'Sales Status'
  ];

  const dataRows = analyzedItems.map(item => [
    item.srNo,
    item.name,
    item.brand,
    item.weight,
    item.mrp,
    item.openingQty,
    item.billsSoldQty,
    item.totalSoldQty,
    item.totalRevenue,
    item.billCount,
    item.avgQtyPerOrder,
    item.paymentSplit?.Cash?.amount || 0,
    item.paymentSplit?.UPI?.amount || 0,
    item.paymentSplit?.Card?.amount || 0,
    item.lastSoldDateTime ? new Date(item.lastSoldDateTime).toLocaleString('en-IN') : 'None',
    item.lastSoldBillNo || 'N/A',
    item.currentStock,
    item.salesStatus
  ]);

  const timestamp = new Date().toISOString().slice(0, 10);
  exportToCSV(`KRLConsolidates_ItemSales_${dateRange}_${timestamp}.csv`, [headers, ...dataRows]);
};

export const exportFullBackupJSON = (products, bills, stallInfo) => {
  const backupData = {
    app: 'KRL Consloidates - Madipakkam (MKMS Onam Celebrations  02/10/2026) Billing App',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    products,
    bills,
    stallInfo
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `KRLConsolidates_FullBackup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

