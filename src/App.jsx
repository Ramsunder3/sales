import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, LayoutDashboard, History, Settings, 
  AlertTriangle, Clock, Flame 
} from 'lucide-react';
import { 
  getProducts, saveProducts, getBills, saveBills, 
  getNextBillNo, incrementBillNo, getAdminPin, saveAdminPin, getStallInfo, updateStallInfo 
} from './utils/storage';

import BillingScreen from './components/BillingScreen';
import DashboardScreen from './components/DashboardScreen';
import ItemSalesScreen from './components/ItemSalesScreen';
import BillHistoryScreen from './components/BillHistoryScreen';
import AdminScreen from './components/AdminScreen';

export default function App() {
  const [products, setProducts] = useState(getProducts);
  const [bills, setBills] = useState(getBills);
  const [currentBillNo, setCurrentBillNo] = useState(getNextBillNo);
  const [adminPin, setAdminPin] = useState(getAdminPin);
  const [stallInfo, setStallInfo] = useState(getStallInfo);

  // Active view tab: 'billing', 'dashboard', 'history', 'admin'
  const [activeView, setActiveView] = useState('billing');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Deep linking to Bill History search/filter
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyItemFilter, setHistoryItemFilter] = useState('');

  const handleNavigateToHistoryWithItem = (itemName) => {
    setHistorySearchQuery(itemName);
    setHistoryItemFilter(itemName);
    setActiveView('history');
  };

  const handleNavigateToHistoryWithDate = (dateQuery) => {
    setHistorySearchQuery(dateQuery);
    setHistoryItemFilter('');
    setActiveView('history');
  };

  const handleClearHistorySearch = () => {
    setHistorySearchQuery('');
    setHistoryItemFilter('');
  };

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Save products whenever updated
  const handleUpdateProducts = (newProducts) => {
    setProducts(newProducts);
    saveProducts(newProducts);
  };

  // Complete a new sale: deduct inventory & save bill
  const handleCompleteSale = (newBill) => {
    // 1. Deduct quantities from products stock
    const updatedProducts = products.map(product => {
      const soldItem = newBill.items.find(i => i.productId === product.id);
      if (soldItem) {
        const newStock = Math.max(0, product.currentStock - soldItem.qty);
        return { ...product, currentStock: newStock };
      }
      return product;
    });

    // 2. Save products & bills
    handleUpdateProducts(updatedProducts);
    const updatedBills = [newBill, ...bills];
    setBills(updatedBills);
    saveBills(updatedBills);

    // 3. Increment bill counter
    incrementBillNo();
    setCurrentBillNo(getNextBillNo());
  };

  // Void a bill: restore inventory stock
  const handleVoidBill = (billNo) => {
    const billToVoid = bills.find(b => b.billNo === billNo);
    if (!billToVoid || billToVoid.status === 'void') return;

    // 1. Restore item quantities back to product current stock
    const updatedProducts = products.map(product => {
      const matchingItems = billToVoid.items.filter(i => 
        i.productId === product.id || 
        String(i.productId) === String(product.srNo) ||
        (i.name && product.name && i.name.trim().toUpperCase() === product.name.trim().toUpperCase() && 
         i.weight && product.weight && i.weight.trim().toUpperCase() === product.weight.trim().toUpperCase())
      );

      if (matchingItems.length > 0) {
        const qtyToRestore = matchingItems.reduce((sum, item) => sum + (parseInt(item.qty, 10) || 0), 0);
        const currentNum = parseInt(product.currentStock, 10) || 0;
        return { ...product, currentStock: currentNum + qtyToRestore };
      }
      return product;
    });

    // 2. Mark bill status as void
    const updatedBills = bills.map(b => 
      b.billNo === billNo ? { ...b, status: 'void' } : b
    );

    handleUpdateProducts(updatedProducts);
    setBills(updatedBills);
    saveBills(updatedBills);
  };

  // Edit/update an existing bill: recalculate inventory stock delta & save bill
  const handleUpdateBill = (updatedBill) => {
    const originalBill = bills.find(b => b.billNo === updatedBill.billNo);
    if (!originalBill) return;

    // 1. Calculate stock difference between original bill and updated bill
    const updatedProducts = products.map(product => {
      const origItems = originalBill.items.filter(i => 
        i.productId === product.id || 
        String(i.productId) === String(product.srNo) ||
        (i.name && product.name && i.name.trim().toUpperCase() === product.name.trim().toUpperCase() && 
         i.weight && product.weight && i.weight.trim().toUpperCase() === product.weight.trim().toUpperCase())
      );
      const origQty = origItems.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);

      const newItems = updatedBill.items.filter(i => 
        i.productId === product.id || 
        String(i.productId) === String(product.srNo) ||
        (i.name && product.name && i.name.trim().toUpperCase() === product.name.trim().toUpperCase() && 
         i.weight && product.weight && i.weight.trim().toUpperCase() === product.weight.trim().toUpperCase())
      );
      const newQty = newItems.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);

      const stockDelta = origQty - newQty; // + means returning to stock, - means deducting from stock
      if (stockDelta !== 0) {
        const currentNum = parseInt(product.currentStock, 10) || 0;
        const nextStock = Math.max(0, currentNum + stockDelta);
        return { ...product, currentStock: nextStock };
      }
      return product;
    });

    // 2. Update bills list
    const updatedBills = bills.map(b => 
      b.billNo === updatedBill.billNo ? updatedBill : b
    );

    // 3. Save products & bills
    handleUpdateProducts(updatedProducts);
    setBills(updatedBills);
    saveBills(updatedBills);
  };

  const handleUpdateAdminPin = (newPin) => {
    setAdminPin(newPin);
    saveAdminPin(newPin);
  };

  const handleUpdateStallInfo = (newInfo) => {
    setStallInfo(newInfo);
    updateStallInfo(newInfo);
  };

  // Count products needing admin setup
  const pendingSetupCount = products.filter(p => p.needsQtySetup || p.needsPriceSetup).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Main Navigation Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-lg shadow-teal-900/50 border border-teal-300/40">
              KRL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight font-heading">
                  KRL Consloidates - Madipakkam
                </h1>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  TNNSS Madipakkam Onam
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Sales Counter • Fast Billing & Live Stock System
              </p>
            </div>
          </div>

          {/* Pending Setup Alert Pill */}
          {pendingSetupCount > 0 && (
            <button
              onClick={() => setActiveView('admin')}
              className="bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-300 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>{pendingSetupCount} Items Need Setup</span>
            </button>
          )}

          {/* Clock & Bill counter info */}
          <div className="hidden lg:flex items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>{currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <span className="text-white font-mono">{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'billing', label: 'Billing Counter', icon: ShoppingCart },
              { id: 'dashboard', label: 'Live Dashboard', icon: LayoutDashboard },
              { id: 'item-sales', label: 'Item Sales Tracker', icon: Flame, isNew: true },
              { id: 'history', label: 'Bill History', icon: History },
              { id: 'admin', label: 'Admin & Stock', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveView(tab.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all relative ${
                    isActive 
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-950 border border-teal-400/30' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${tab.id === 'item-sales' && !isActive ? 'text-amber-400' : ''}`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main App Workspace Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeView === 'billing' && (
          <BillingScreen
            products={products}
            onUpdateProducts={handleUpdateProducts}
            bills={bills}
            onCompleteSale={handleCompleteSale}
            currentBillNo={currentBillNo}
            stallInfo={stallInfo}
            onNavigateToAdmin={() => setActiveView('admin')}
            onNavigateToItemSales={() => setActiveView('item-sales')}
          />
        )}

        {activeView === 'dashboard' && (
          <DashboardScreen
            products={products}
            bills={bills}
            onNavigateToItemSales={() => setActiveView('item-sales')}
            onNavigateToHistoryWithItem={handleNavigateToHistoryWithItem}
            onNavigateToHistoryWithDate={handleNavigateToHistoryWithDate}
          />
        )}

        {activeView === 'item-sales' && (
          <ItemSalesScreen
            products={products}
            bills={bills}
            stallInfo={stallInfo}
            onNavigateToHistoryWithItem={handleNavigateToHistoryWithItem}
          />
        )}

        {activeView === 'history' && (
          <BillHistoryScreen
            bills={bills}
            products={products}
            onVoidBill={handleVoidBill}
            onUpdateBill={handleUpdateBill}
            stallInfo={stallInfo}
            initialSearchQuery={historySearchQuery}
            initialItemFilter={historyItemFilter}
            onClearInitialSearch={handleClearHistorySearch}
          />
        )}

        {activeView === 'admin' && (
          <AdminScreen
            products={products}
            onUpdateProducts={handleUpdateProducts}
            bills={bills}
            adminPin={adminPin}
            onUpdateAdminPin={handleUpdateAdminPin}
            stallInfo={stallInfo}
            onUpdateStallInfo={handleUpdateStallInfo}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 text-center text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong>KRL Consloidates - Madipakkam (Tamil Nadu Nair Service Society)</strong> • Official Stall Billing & Inventory Software
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400 font-mono">Live Sync Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
