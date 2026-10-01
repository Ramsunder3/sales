import { INITIAL_PRODUCTS } from '../data/seedData';

const STORAGE_KEYS = {
  PRODUCTS: 'malayalee_club_products_v1',
  BILLS: 'malayalee_club_bills_v1',
  BILL_COUNTER: 'malayalee_club_bill_counter_v1',
  ADMIN_PIN: 'malayalee_club_admin_pin_v1',
  STALL_INFO: 'malayalee_club_stall_info_v1'
};

const DEFAULT_PIN = '1234';

const DEFAULT_STALL_INFO = {
  stallName: 'KRL Consolidates - Madipakkam ( MKMS Onam Celebrations  02/10/2026)',
  eventTitle: 'KRL Consolidates - Madipakkam ( MKMS Onam Celebrations  02/10/2026)',
  location: 'Madipakkam , Chennai',
  headerNote: 'Food & Gourmet Products Counter'
};

export const getProducts = () => {
  try {
    const resetKey = 'malayalee_club_stocks_reset_to_zero_v1';
    const hasBeenReset = localStorage.getItem(resetKey);
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);

    if (!hasBeenReset) {
      localStorage.setItem(resetKey, 'true');
      const baseList = data ? JSON.parse(data) : INITIAL_PRODUCTS;
      const zeroedList = baseList.map(p => ({
        ...p,
        openingQty: 0,
        alreadySoldYesterday: 0,
        currentStock: 0,
        needsQtySetup: true
      }));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(zeroedList));
      return zeroedList;
    }

    if (!data) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to read products from localStorage:', e);
    return INITIAL_PRODUCTS;
  }
};

export const saveProducts = (products) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } catch (e) {
    console.error('Failed to save products:', e);
  }
};

export const getBills = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BILLS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to read bills:', e);
    return [];
  }
};

export const saveBills = (bills) => {
  try {
    localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify(bills));
  } catch (e) {
    console.error('Failed to save bills:', e);
  }
};

export const getNextBillNo = () => {
  try {
    const counter = localStorage.getItem(STORAGE_KEYS.BILL_COUNTER);
    if (!counter) {
      localStorage.setItem(STORAGE_KEYS.BILL_COUNTER, '1001');
      return 'BILL-1001';
    }
    const num = parseInt(counter, 10);
    return `BILL-${num}`;
  } catch (e) {
    return 'BILL-1001';
  }
};

export const incrementBillNo = () => {
  try {
    const counter = localStorage.getItem(STORAGE_KEYS.BILL_COUNTER) || '1001';
    const nextNum = parseInt(counter, 10) + 1;
    localStorage.setItem(STORAGE_KEYS.BILL_COUNTER, nextNum.toString());
  } catch (e) {
    console.error('Failed to increment bill counter:', e);
  }
};

export const getAdminPin = () => {
  return localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || DEFAULT_PIN;
};

export const saveAdminPin = (newPin) => {
  localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, newPin);
};

export const getStallInfo = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STALL_INFO);
    if (!data) return DEFAULT_STALL_INFO;
    const parsed = JSON.parse(data);
    if (parsed.stallName === 'KRL Consloidates TNNSS Madipakkam Onam Celebrations' || !parsed.stallName?.includes('Madipakkam')) {
      parsed.stallName = DEFAULT_STALL_INFO.stallName;
      parsed.eventTitle = DEFAULT_STALL_INFO.eventTitle;
      localStorage.setItem(STORAGE_KEYS.STALL_INFO, JSON.stringify(parsed));
    }
    return parsed;
  } catch (e) {
    return DEFAULT_STALL_INFO;
  }
};

export const updateStallInfo = (info) => {
  localStorage.setItem(STORAGE_KEYS.STALL_INFO, JSON.stringify(info));
};

export const resetToDefaults = () => {
  localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS));
  localStorage.setItem(STORAGE_KEYS.BILLS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.BILL_COUNTER, '1001');
  localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, DEFAULT_PIN);
  localStorage.setItem(STORAGE_KEYS.STALL_INFO, JSON.stringify(DEFAULT_STALL_INFO));
};

export const resetAllStocksToZero = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const list = data ? JSON.parse(data) : INITIAL_PRODUCTS;
    const zeroed = list.map(p => ({
      ...p,
      openingQty: 0,
      alreadySoldYesterday: 0,
      currentStock: 0,
      needsQtySetup: true
    }));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(zeroed));
    return zeroed;
  } catch (e) {
    console.error('Failed to reset stocks to zero:', e);
    return INITIAL_PRODUCTS;
  }
};

export const clearAllProducts = () => {
  try {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify([]));
    return [];
  } catch (e) {
    console.error('Failed to clear all products:', e);
    return [];
  }
};
