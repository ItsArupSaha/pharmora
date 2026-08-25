

export const FEATURE_KEYS = [
  'sell',
  'items',
  'purchases',
  'expenses',
  'expiry-alerts',
  'stock-warnings',
  'reports',
  'business-overview',
  'payables',
  'customer-dues',
  'shelf-update',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type AppMode = 'normal' | 'stock';

export type AccountStatus = 'active' | 'disabled';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isApproved: boolean;
  createdAt: any; // Firestore Timestamp

  // Mode & access control
  appMode?: AppMode;
  appModeChosen?: boolean;
  accountStatus?: AccountStatus;
  disabledFeatures?: FeatureKey[];

  // Onboarding fields
  companyName?: string;
  subtitle?: string;
  address?: string;
  phone?: string;
  bkashNumber?: string;
  bankInfo?: string;
  onboardingComplete?: boolean;
  // Initial capital
  initialCash?: number;
  initialBank?: number;
  storeType?: 'general' | 'pharmacy' | 'bookstore';
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  address: string;
  openingBalance: number;
  dueBalance: number;
};

export type CustomerWithDue = Customer & {
  dueBalance: number;
};

export type Category = {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
};

export type Item = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  medicineGroup?: string; // Generic / salt name
  company?: string; // Manufacturer
  expiryDate?: string; // Stored as YYYY-MM-DD string
  location?: string; // Optional shelf/row storage location
  productionPrice: number;
  sellingPrice: number;
  stock: number;
  ignoredWarning?: boolean;
  isSalable?: boolean; // false for owned equipment (assets/surgicals); defaults true
};

export type ClosingStock = Item & {
  closingStock: number;
};

export type SaleBatchAllocation = {
  batchId: string;
  batchNo: string;
  expiryDate?: string | null;
  quantity: number;
  costAtSale: number; // frozen batch cost per unit at sale time
};

export type SaleItem = {
    itemId: string;
    quantity: number;
    price: number; // This is the selling price at the time of sale
    batches?: SaleBatchAllocation[]; // FEFO allocation when the item is batch-tracked
};

export type ItemBatch = {
  batchNo: string;
  expiryDate?: string | null; // YYYY-MM-DD
  quantity: number;
  initialQuantity: number;
  cost: number; // landed (capitalized) cost per unit
  purchaseId?: string; // purchase that received this batch
  createdAt?: any; // Firestore Timestamp
};

export type Sale = {
  id: string;
  saleId: string; // The auto-generated ID like SALE-0001
  date: string; // Changed to string for serialization
  customerId: string;
  items: SaleItem[];
  subtotal: number;
  discountType: 'none' | 'percentage' | 'amount';
  discountValue: number;
  total: number;
  paymentMethod: 'Cash' | 'Bank' | 'Due' | 'Split' | 'Paid by Credit';
  amountPaid?: number;
  splitPaymentMethod?: 'Cash' | 'Bank';
  creditApplied?: number;
  extraSales?: number;
};

export type SalesReturnItem = {
  itemId: string;
  quantity: number;
  price: number; // The price at which the item was sold, used for credit.
};

export type SalesReturn = {
  id: string;
  returnId: string;
  date: string;
  customerId: string;
  items: SalesReturnItem[];
  totalReturnValue: number;
};


export type PurchaseItem = {
    itemName: string;
    categoryId: string;
    categoryName: string;
    medicineGroup?: string;
    company?: string;
    expiryDate?: string;
    batchNo?: string;
    location?: string;
    quantity: number;
    cost: number;
    sellingPrice?: number;
};


export type Purchase = {
    id: string;
    purchaseId: string; // The auto-generated ID like PUR-0001
    date: string;
    supplier: string;
    items: PurchaseItem[];
    totalAmount: number;
    discountAmount?: number;
    vatType?: 'amount' | 'percentage';
    vatValue?: number;
    vatAmount?: number;
    paymentMethod: 'Cash' | 'Bank' | 'Due' | 'Split' | 'N/A';
    amountPaid?: number;
    splitPaymentMethod?: 'Cash' | 'Bank';
    dueDate: string;
};

export type Expense = {
  id: string;
  expenseId: string; // The auto-generated ID like EXP-0001
  date: string; // Changed to string for serialization
  description: string;
  amount: number;
  paymentMethod?: 'Cash' | 'Bank';
  purchaseId?: string; // Set when the expense pays for a specific purchase
};

export type Capital = {
  id: string;
  date: string;
  source: 'Initial Capital' | 'Capital Adjustment';
  amount: number;
  paymentMethod: 'Cash' | 'Bank' | 'Asset';
  notes?: string;
};

export type InitialCapital = {
  cash: number;
  bank: number;
}

export type SecurityDeposit = {
  id: string;
  securityId: string;
  date: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank';
  status: 'Refundable' | 'Refunded';
  notes?: string;
  refundDate?: string;
  refundPaymentMethod?: 'Cash' | 'Bank';
};

export type Transaction = {
  id: string;
  description: string;
  amount: number;
  dueDate: string; // Changed to string for serialization
  status: 'Pending' | 'Paid';
  type: 'Receivable' | 'Payable';
  paymentMethod?: 'Cash' | 'Bank';
  customerId?: string;
  customerName?: string;
  saleId?: string; // Link to the sale
  purchaseId?: string; // Link to the purchase for payables
  isHiddenFromHistory?: boolean;
  // New fields for profit tracking on receivables
  totalSaleProfit?: number;
  remainingProfit?: number;
  recognizedProfit?: number;
};

// Metadata for counters, etc.
export type Metadata = {
  lastPurchaseNumber: number;
  lastSaleNumber: number;
  lastReturnNumber: number;
  lastExpenseNumber: number;
}

export type PackageItem = {
    itemId: string;
    quantity: number;
};

export type PackageTemplate = {
    id: string;
    name: string;
    description: string;
    items: PackageItem[];
    createdAt: string; // ISO string
};

