import React, { useState, useMemo } from 'react';
import { 
  Search, ShoppingCart, Plus, Minus, Trash2, 
  AlertCircle, CreditCard, Banknote, QrCode, FileText, Printer, X, Edit3, MessageSquare, Share2, Flame,
  CheckCircle2, PackagePlus, Tag
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CATEGORIES } from '../data/seedData';
import { generateBillPDF, shareBillPDFToCustomer } from '../utils/pdfGenerator';
import { sendWhatsAppBill } from '../utils/whatsapp';
import PrintReceiptModal from './PrintReceiptModal';

export default function BillingScreen({ 
  products = [], 
  onUpdateProducts,
  bills = [],
  onCompleteSale, 
  currentBillNo, 
  stallInfo,
  onNavigateToAdmin,
  onNavigateToItemSales
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  
  // Checkout details
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash'); // Cash, UPI, Card
  const [discount, setDiscount] = useState(0);
  const [customGrandTotal, setCustomGrandTotal] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(null);
  const [stockWarning, setStockWarning] = useState(null);

  // Add new product state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addItemSuccessMsg, setAddItemSuccessMsg] = useState('');
  const [newProdForm, setNewProdForm] = useState({
    name: '',
    brand: 'Ponkathir',
    customBrand: '',
    weight: '500GM',
    mrp: '',
    openingQty: '50',
    addToCartImmediately: true
  });

  const handleOpenAddModal = (prefillName = '') => {
    setNewProdForm({
      name: prefillName || searchQuery || '',
      brand: selectedCategory !== 'All' ? selectedCategory : 'Ponkathir',
      customBrand: '',
      weight: '500GM',
      mrp: '',
      openingQty: '50',
      addToCartImmediately: true
    });
    setShowAddProductModal(true);
  };

  const handleSaveNewProduct = (e) => {
    e.preventDefault();
    if (!newProdForm.name.trim()) return;

    const brandName = newProdForm.brand === 'CUSTOM'
      ? (newProdForm.customBrand.trim() || 'Other')
      : newProdForm.brand;

    const newId = `PROD-${Date.now().toString().slice(-4)}`;
    const nextSrNo = products.length + 1;
    const initialQty = parseInt(newProdForm.openingQty, 10) || 0;
    const mrpVal = parseFloat(newProdForm.mrp) || 0;

    const createdProduct = {
      id: newId,
      srNo: nextSrNo,
      name: newProdForm.name.trim().toUpperCase(),
      brand: brandName,
      weight: newProdForm.weight.trim().toUpperCase() || '1PC',
      mrp: mrpVal,
      openingQty: initialQty,
      alreadySoldYesterday: 0,
      currentStock: initialQty,
      needsQtySetup: false,
      needsPriceSetup: false
    };

    if (onUpdateProducts) {
      onUpdateProducts([...products, createdProduct]);
    }

    if (newProdForm.addToCartImmediately) {
      setCart(prev => {
        const exists = prev.find(item => item.id === createdProduct.id);
        if (exists) {
          return prev.map(item => item.id === createdProduct.id ? { ...item, qty: item.qty + 1 } : item);
        }
        return [...prev, { ...createdProduct, qty: 1 }];
      });
    }

    setShowAddProductModal(false);
    setAddItemSuccessMsg(`Item "${createdProduct.name}" added to catalog successfully!`);
    setTimeout(() => setAddItemSuccessMsg(''), 4000);
  };

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedCategory === 'All' || p.brand === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) || 
        p.weight.toLowerCase().includes(q) ||
        p.srNo.toString() === q;
      
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, selectedCategory]);

  // Live sold items map computed by analyzing previous bills
  const liveItemSalesMap = useMemo(() => {
    const map = {};
    (bills || []).forEach(bill => {
      if (bill.status === 'void' || !bill.items) return;
      bill.items.forEach(item => {
        const idKey = item.productId;
        const nameWeightKey = `${(item.name || '').trim().toUpperCase()}-${(item.weight || '').trim().toUpperCase()}`;
        const qty = parseInt(item.qty, 10) || 0;
        if (idKey) map[idKey] = (map[idKey] || 0) + qty;
        if (nameWeightKey) map[nameWeightKey] = (map[nameWeightKey] || 0) + qty;
      });
    });
    return map;
  }, [bills]);

  const getItemSoldQty = (product) => {
    const idKey = product.id;
    const nameWeightKey = `${(product.name || '').trim().toUpperCase()}-${(product.weight || '').trim().toUpperCase()}`;
    const fromBills = (liveItemSalesMap[idKey] || 0) || (liveItemSalesMap[nameWeightKey] || 0);
    return fromBills + (product.alreadySoldYesterday || 0);
  };

  // Count pending setup items to display warning banner if any
  const pendingSetupCount = useMemo(() => {
    return products.filter(p => p.needsQtySetup || p.needsPriceSetup).length;
  }, [products]);

  // Cart calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.mrp * item.qty), 0);
  }, [cart]);

  // Payment mode & Manual Price Override calculations:
  const { grandTotal, totalDiscount, roundOffAmount, isCustomOverride } = useMemo(() => {
    // If counter staff typed a manual custom bill price override (e.g. 250)
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
      // GPay / UPI / Card: Full exact amount without round off!
      return {
        grandTotal: afterManual,
        totalDiscount: manualDisc,
        roundOffAmount: 0,
        isCustomOverride: false
      };
    }
  }, [subtotal, discount, customGrandTotal, paymentMode]);

  const changeToReturn = useMemo(() => {
    const given = parseFloat(cashGiven) || 0;
    return Math.max(0, given - grandTotal);
  }, [cashGiven, grandTotal]);

  // Add item to cart
  const handleAddToCart = (product) => {
    if (product.currentStock <= 0) {
      setStockWarning(`"${product.name}" is currently OUT OF STOCK! Please update stock in Admin.`);
      return;
    }

    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);
      if (existing) {
        if (existing.qty + 1 > product.currentStock) {
          setStockWarning(`Cannot add more than available stock (${product.currentStock} remaining).`);
          return prevCart;
        }
        return prevCart.map(item => 
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      } else {
        return [...prevCart, { 
          id: product.id, 
          srNo: product.srNo, 
          name: product.name, 
          weight: product.weight, 
          brand: product.brand,
          mrp: product.mrp, 
          qty: 1,
          availableStock: product.currentStock 
        }];
      }
    });
  };

  // Update item quantity in cart
  const handleUpdateQty = (productId, delta) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          const newQty = item.qty + delta;
          if (newQty <= 0) return null;
          if (newQty > item.availableStock) {
            setStockWarning(`Only ${item.availableStock} units available in stock!`);
            return item;
          }
          return { ...item, qty: newQty };
        }
        return item;
      }).filter(Boolean);
    });
  };

  const handleSetExactQty = (productId, value) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty <= 0) {
      handleRemoveItem(productId);
      return;
    }

    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === productId) {
          if (qty > item.availableStock) {
            setStockWarning(`Only ${item.availableStock} units available!`);
            return { ...item, qty: item.availableStock };
          }
          return { ...item, qty };
        }
        return item;
      });
    });
  };

  const handleUpdateItemRate = (productId, value) => {
    const rate = parseFloat(value);
    setCart(prevCart => prevCart.map(item => 
      item.id === productId ? { ...item, mrp: isNaN(rate) ? 0 : rate } : item
    ));
  };

  const handleClearCart = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
    setCustomGrandTotal('');
    setCashGiven('');
  };

  // Complete Sale execution
  const processSale = (actionType = 'download') => {
    if (cart.length === 0) return;

    // Build completed bill record
    const billRecord = {
      billNo: currentBillNo,
      dateTime: new Date().toISOString(),
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMode,
      subtotal,
      discount: totalDiscount,
      roundOffAmount,
      grandTotal,
      cashGiven: paymentMode === 'Cash' ? (parseFloat(cashGiven) || undefined) : undefined,
      changeToReturn: paymentMode === 'Cash' ? changeToReturn : undefined,
      status: 'active',
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        brand: item.brand,
        weight: item.weight,
        qty: item.qty,
        rate: item.mrp,
        amount: item.mrp * item.qty
      }))
    };

    // Trigger visual celebratory particles
    try {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 }
      });
    } catch (e) {}

    // Invoke parent completion handler to save bill and update stock live
    onCompleteSale(billRecord);

    if (actionType === 'download') {
      generateBillPDF(billRecord, stallInfo);
    } else if (actionType === 'print') {
      setShowPrintModal(billRecord);
    } else if (actionType === 'whatsapp') {
      sendWhatsAppBill(billRecord, stallInfo, customerPhone);
    } else if (actionType === 'share_pdf') {
      shareBillPDFToCustomer(billRecord, stallInfo, customerPhone);
    }

    // Reset current billing cart
    handleClearCart();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Product Catalog & Fast Search (7 cols on Desktop) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Warning Banner if pending Admin Setup items exist */}
        {pendingSetupCount > 0 && (
          <div className="bg-amber-950/60 border border-amber-500/40 rounded-xl p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <div className="text-amber-200 font-semibold text-sm">
                  {pendingSetupCount} Products Need Opening Stock / Price Review
                </div>
                <div className="text-amber-400/80 text-xs">
                  Some items have unconfirmed prices or 0 opening stock from yesterday's sheet.
                </div>
              </div>
            </div>
            <button
              onClick={onNavigateToAdmin}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shrink-0"
            >
              Review Now
            </button>
          </div>
        )}

        {/* Stock Warning Toast Modal */}
        {stockWarning && (
          <div className="bg-rose-950/90 border border-rose-500 rounded-xl p-4 flex items-center justify-between text-rose-200 text-sm shadow-xl animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{stockWarning}</span>
            </div>
            <button 
              onClick={() => setStockWarning(null)}
              className="text-rose-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Item Added Success Toast */}
        {addItemSuccessMsg && (
          <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-xl p-3.5 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 shadow-lg animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{addItemSuccessMsg}</span>
          </div>
        )}

        {/* Search Bar & Stats */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search product by name, brand, weight (e.g. puttu, 500gm)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-base"
                autoFocus
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Add Product Button */}
            <button
              onClick={() => handleOpenAddModal(searchQuery)}
              className="px-4 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-lg shadow-teal-950 transition shrink-0 border border-teal-400/30"
              title="Add a new custom product to catalog"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Item</span>
            </button>
          </div>

          {/* Category Filter Pills & Live Tracker Link */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
              {CATEGORIES.map(cat => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      isActive 
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-900/40 border border-teal-400/30' 
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {onNavigateToItemSales && (
              <button
                onClick={onNavigateToItemSales}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1 shrink-0"
                title="Open Live Item Sales Tracker"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Items Sold</span>
              </button>
            )}
          </div>
        </div>

        {/* Product Catalog Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="col-span-full glass-panel p-8 text-center text-slate-400 space-y-3">
              <Search className="w-10 h-10 mx-auto opacity-40 text-slate-500" />
              <div>
                <p className="text-base font-bold text-white">No products found matching "{searchQuery}"</p>
                <p className="text-xs text-slate-400 mt-0.5">Item not in catalog yet? You can create and add it immediately.</p>
              </div>
              <button
                onClick={() => handleOpenAddModal(searchQuery)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add "{searchQuery || 'New Product'}" to Catalog</span>
              </button>
            </div>
          ) : (
            filteredProducts.map(product => {
              const isOutOfStock = product.currentStock <= 0;
              const isLowStock = product.currentStock > 0 && product.currentStock <= 5;
              const cartItem = cart.find(i => i.id === product.id);
              const soldQty = getItemSoldQty(product);

              return (
                <div 
                  key={product.id}
                  onClick={() => !isOutOfStock && handleAddToCart(product)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative group ${
                    isOutOfStock 
                      ? 'bg-slate-900/50 border-slate-800 opacity-60' 
                      : isLowStock 
                      ? 'bg-slate-800/80 border-amber-500/30 hover:border-amber-500 hover:bg-slate-800' 
                      : 'bg-slate-800/90 border-slate-700/80 hover:border-teal-500/80 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    {/* Top line: Sr No, Brand Badge, and Live Sold Pill */}
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-700/50">
                          #{product.srNo}
                        </span>
                        <span className="text-[11px] font-semibold text-teal-300 bg-teal-950/60 border border-teal-800/50 px-2 py-0.5 rounded">
                          {product.brand}
                        </span>
                      </div>

                      {soldQty > 0 ? (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-700/80 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <Flame className="w-3 h-3 text-amber-400" />
                          <span>{soldQty} sold</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 bg-slate-900/80 border border-slate-800 px-1.5 py-0.5 rounded shrink-0">
                          0 sold
                        </span>
                      )}
                    </div>

                    {/* Product Title & Weight */}
                    <h4 className="font-bold text-slate-100 text-sm leading-snug line-clamp-2">
                      {product.name}
                    </h4>
                    <div className="text-xs font-semibold text-slate-400 mt-0.5">
                      {product.weight}
                    </div>
                  </div>

                  {/* Bottom info: Price, Stock & Add button */}
                  <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-400">MRP</div>
                      <div className="text-lg font-extrabold text-emerald-400">
                        ₹{product.mrp}
                      </div>
                    </div>

                    <div className="text-right">
                      {/* Stock Pill */}
                      {isOutOfStock ? (
                        <span className="badge-red block text-[10px] mb-1">OUT OF STOCK</span>
                      ) : isLowStock ? (
                        <span className="badge-amber block text-[10px] mb-1">Stock: {product.currentStock} left</span>
                      ) : (
                        <span className="badge-green block text-[10px] mb-1">Stock: {product.currentStock}</span>
                      )}

                      {/* Add Button / In-cart Counter */}
                      {cartItem ? (
                        <div className="flex items-center gap-1 bg-teal-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow">
                          <span>{cartItem.qty} in bill</span>
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <button
                          disabled={isOutOfStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                            isOutOfStock 
                              ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                              : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md shadow-teal-900/30'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Live Billing Counter & Cart (5 cols on Desktop) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="glass-panel p-5 border-teal-500/30 shadow-2xl flex flex-col min-h-[600px] justify-between">
          <div>
            {/* Header: Bill # and Live Clock */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Current Bill</h3>
                  <div className="text-xs text-teal-400 font-mono font-semibold">
                    {currentBillNo}
                  </div>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 bg-rose-950/40 border border-rose-900/60 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="my-3 space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-400">Cart is currently empty</p>
                  <p className="text-xs text-slate-500 mt-1">Tap products on the left to add items to bill</p>
                </div>
              ) : (
                cart.map(item => (
                  <div 
                    key={item.id}
                    className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-slate-200 truncate">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{item.weight} • ₹</span>
                        <input
                          type="number"
                          value={item.mrp}
                          onChange={(e) => handleUpdateItemRate(item.id, e.target.value)}
                          className="w-12 bg-slate-950 text-emerald-400 font-bold border border-slate-700 rounded px-1 text-center text-xs focus:outline-none focus:border-teal-500"
                          title="Click to edit item rate"
                        />
                      </div>
                    </div>

                    {/* Qty controller */}
                    <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1">
                      <button
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      
                      <input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.qty}
                        onChange={(e) => handleSetExactQty(item.id, e.target.value)}
                        className="w-8 text-center bg-transparent text-white font-bold text-xs focus:outline-none"
                      />

                      <button
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right min-w-[55px]">
                      <div className="text-xs font-bold text-emerald-400">
                        ₹{item.mrp * item.qty}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Customer Details & Payment Options */}
            {cart.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-700/80">
                {/* Optional Customer Inputs */}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Cust. Name (Optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                  <input
                    type="tel"
                    placeholder="Phone (Optional)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Payment Mode Selection */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Select Payment Mode:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'Cash', label: 'Cash', sub: 'Discounted', icon: Banknote },
                      { id: 'UPI', label: 'GPay / UPI', sub: 'Exact Amt', icon: QrCode },
                      { id: 'Card', label: 'Card', sub: 'Exact Amt', icon: CreditCard }
                    ].map(mode => {
                      const IconComponent = mode.icon;
                      const isSelected = paymentMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setPaymentMode(mode.id)}
                          className={`py-2 px-1.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center transition ${
                            isSelected 
                              ? 'bg-teal-600 text-white shadow-lg border border-teal-400' 
                              : 'bg-slate-900 text-slate-400 border border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <IconComponent className="w-3.5 h-3.5" />
                            <span>{mode.label}</span>
                          </div>
                          <span className={`text-[9px] font-medium mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                            {mode.sub}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Cash Calculator (if Payment Mode is Cash) */}
                {paymentMode === 'Cash' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-400">Cash Received:</span>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value)}
                        className="w-24 text-right px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-bold text-white focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    {/* Quick preset buttons */}
                    <div className="flex gap-1 justify-end">
                      {[grandTotal, 100, 200, 500, 1000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashGiven(val.toString())}
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded border border-slate-700"
                        >
                          ₹{val}
                        </button>
                      ))}
                    </div>

                    {parseFloat(cashGiven) > 0 && (
                      <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                        <span className="text-slate-400">Change to Return:</span>
                        <span className={`font-extrabold ${changeToReturn > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                          ₹{changeToReturn}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Subtotal & Payment Rounding Summary */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-200">₹{subtotal}</span>
                  </div>

                  {!isCustomOverride && (
                    paymentMode === 'Cash' ? (
                      <div className="flex justify-between text-teal-400 font-semibold">
                        <span>Discount:</span>
                        <span>-₹{roundOffAmount}</span>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-400 text-[11px]">
                        <span>Payment Mode:</span>
                        <span className="text-emerald-400 font-semibold">{paymentMode} (Exact Amount)</span>
                      </div>
                    )
                  )}

                  {/* Manual Bill Price Override Option */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                    <div className="flex items-center gap-1 text-amber-300 font-semibold">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Manual Custom Bill Total (₹):</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 250"
                      value={customGrandTotal}
                      onChange={(e) => setCustomGrandTotal(e.target.value)}
                      className="w-24 text-right px-2 py-1 bg-amber-950/50 border border-amber-500/50 rounded-lg text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 placeholder-slate-500"
                      title="Override exact final bill price"
                    />
                  </div>

                  {!isCustomOverride && (
                    <div className="flex items-center justify-between text-xs pt-0.5">
                      <span className="text-slate-400 font-medium">Extra Discount (₹):</span>
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
                </div>
              </div>
            )}
          </div>

          {/* Grand Total & Checkout Actions */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-slate-700/80 space-y-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-400">Grand Total</div>
                  <div className="text-xs text-slate-500">{cart.reduce((sum, i) => sum + i.qty, 0)} items</div>
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-heading">
                  ₹{grandTotal}
                </div>
              </div>

              {/* Checkout Action Buttons */}
              <div className="space-y-2">
                <button
                  onClick={() => processSale('share_pdf')}
                  className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition border border-emerald-400/30"
                >
                  <Share2 className="w-4 h-4 text-emerald-200" />
                  <span>Share PDF Receipt to Customer {customerPhone ? `(${customerPhone})` : ''}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => processSale('whatsapp')}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition border border-slate-700"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    WhatsApp Text
                  </button>

                  <button
                    onClick={() => processSale('download')}
                    className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition border border-slate-700"
                  >
                    <FileText className="w-4 h-4 text-teal-400" />
                    Download PDF
                  </button>
                </div>

                <button
                  onClick={() => processSale('print')}
                  className="w-full py-2.5 px-3 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Printer className="w-4 h-4" />
                  Print Thermal Receipt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Printable Receipt Preview Modal */}
      {showPrintModal && (
        <PrintReceiptModal
          bill={showPrintModal}
          stallInfo={stallInfo}
          onClose={() => setShowPrintModal(null)}
        />
      )}

      {/* Add New Product to Catalog Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add New Item to Catalog</h3>
                  <p className="text-xs text-slate-400">Save a new product to inventory and optionally add to current bill.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewProduct} className="space-y-4">
              {/* Product Name */}
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Product Description / Item Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. SPECIAL JACKFRUIT HALWA"
                  value={newProdForm.name}
                  onChange={(e) => setNewProdForm({ ...newProdForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              {/* Brand Selector & Custom Brand */}
              <div className="space-y-2">
                <label className="text-xs text-slate-300 font-bold block">
                  Brand / Category *
                </label>
                <select
                  value={newProdForm.brand}
                  onChange={(e) => setNewProdForm({ ...newProdForm, brand: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 font-semibold cursor-pointer"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="CUSTOM">+ Custom Brand Name...</option>
                </select>

                {newProdForm.brand === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    placeholder="Type custom brand name (e.g. Aachi, MTR, Homemade)..."
                    value={newProdForm.customBrand}
                    onChange={(e) => setNewProdForm({ ...newProdForm, customBrand: e.target.value })}
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
                  value={newProdForm.weight}
                  onChange={(e) => setNewProdForm({ ...newProdForm, weight: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 font-mono font-semibold"
                />
                {/* Preset weight buttons */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {['100GM', '200GM', '250GM', '500GM', '1KG', '2KG', '5KG', '1PC'].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setNewProdForm({ ...newProdForm, weight: w })}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                        newProdForm.weight.toUpperCase() === w
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
                    placeholder="e.g. 120"
                    value={newProdForm.mrp}
                    onChange={(e) => setNewProdForm({ ...newProdForm, mrp: e.target.value })}
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
                    value={newProdForm.openingQty}
                    onChange={(e) => setNewProdForm({ ...newProdForm, openingQty: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Checkbox: Add to current cart */}
              <label className="flex items-center gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800 cursor-pointer hover:border-teal-500/50 transition">
                <input
                  type="checkbox"
                  checked={newProdForm.addToCartImmediately}
                  onChange={(e) => setNewProdForm({ ...newProdForm, addToCartImmediately: e.target.checked })}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 bg-slate-900 border-slate-700 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-200">
                  Immediately add 1 unit of this item to the current billing cart
                </span>
              </label>

              {/* Action Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-950 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save & Add Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
