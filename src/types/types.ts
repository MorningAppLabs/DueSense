export interface Card {
  id: string;
  name: string;
  billingCycle: { start: number; end: number };
  limit: number;
  cashbackRules: CashbackRule[];
  /** Day of month when bill payment is due (1–31) */
  dueDate?: number;
  /** Hex color for visual identity, e.g. "#4361EE" */
  color?: string;
  /** Optional last 4 digits for display */
  lastFourDigits?: string;
  /** Optional bank/network logo identifier */
  network?: 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Diners' | 'Other';
  /** Annual fee amount in the user's currency */
  annualFee?: number;
  /** Annual fee due date as "MM-DD" (e.g. "03-15" = March 15) */
  annualFeeDate?: string;
  /** Minimum yearly spend required to waive the annual fee */
  annualFeeWaiverThreshold?: number;
}

/** A spending category with a user-chosen Feather icon name */
export interface Category {
  name: string;
  /** Feather icon name, e.g. "coffee", "shopping-bag" */
  icon: string;
}

export interface CashbackRule {
  onlineOffline: "Online" | "Offline" | "Both";
  paymentType: "Full Payment" | "EMI";
  merchant: string;
  percentage: number;
  limit?: number;
  categories: string[];
}

export interface Transaction {
  id: string;
  cardId: string;
  amount: number;
  paymentType: "Full Payment" | "EMI";
  emiPlan?: { amount: number; months: number; interest: number };
  date: string;
  onlineOffline: "Online" | "Offline";
  merchant: string;
  description: string;
  category: string;
  cashback: number;
  forWhom: "Myself" | "Someone Else";
  personName?: string;
  repaid: boolean;
}

export interface Repayment {
  id: string;
  cardId: string;
  amount: number;
  date: string;
  description?: string;
  billingCycleStart?: string;
}

export interface Settings {
  currency: string;
  notificationTimes: {
    dueDate: string;
    owedMoney: string;
    billEmi: string;
    subscription: string;
  };
  sync: {
    local: boolean;
    cloud: boolean;
  };
  biometricEnabled?: boolean;
}

export type SubscriptionPaymentMethod = 'Card' | 'UPI' | 'PayPal' | 'Other';
export type SubscriptionBillingCycle = 'Weekly' | 'Monthly' | 'Quarterly' | 'Yearly';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  paymentMethod: SubscriptionPaymentMethod;
  /** Card ID if paymentMethod === 'Card' */
  cardId?: string;
  /** Custom label for UPI, PayPal, or Other (e.g. "Google Pay", "PhonePe") */
  customMethodName?: string;
  billingCycle: SubscriptionBillingCycle;
  /** YYYY-MM-DD – the next billing date */
  nextBillingDate: string;
  category: string;
  notes?: string;
  active: boolean;
}

export interface StoreState {
  cards: Card[];
  transactions: Transaction[];
  repayments: Repayment[];
  subscriptions: Subscription[];
  settings: Settings;
  merchants: string[];
  categories: Category[];
  persons: string[];
  notificationIds: Record<string, string>;
  addCard: (card: Card) => void;
  updateCard: (card: Card) => void;
  deleteCard: (id: string) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addRepayment: (repayment: Repayment) => void;
  updateRepayment: (repayment: Repayment) => void;
  deleteRepayment: (id: string) => void;
  addSubscription: (subscription: Subscription) => void;
  updateSubscription: (subscription: Subscription) => void;
  deleteSubscription: (id: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  addMerchant: (merchant: string) => void;
  addCategory: (category: Category) => void;
  addPerson: (person: string) => void;
  loadData: () => Promise<void>;
  setState: (newState: Partial<StoreState>) => void;
}
