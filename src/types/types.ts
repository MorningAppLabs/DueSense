export interface Card {
  id: string;
  name: string;
  billingCycle: { start: number; end: number };
  limit: number;
  cashbackRules: CashbackRule[];
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
  };
  sync: {
    local: boolean;
    cloud: boolean;
  };
}

// Add to store state
export interface StoreState {
  cards: Card[];
  transactions: Transaction[];
  merchants: string[];
  categories: string[]; // New global categories store
  persons: string[];
  settings: {
    currency: string;
    notificationTimes: {
      dueDate: string;
      owedMoney: string;
      billEmi: string;
    };
  };
}
