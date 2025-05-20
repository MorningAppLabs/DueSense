import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card, Transaction, Repayment, Settings } from "../types/types";
import { saveToStorage, loadFromStorage } from "../utils/storage";

interface AppState {
  cards: Card[];
  transactions: Transaction[];
  repayments: Repayment[];
  settings: Settings;
  merchants: string[];
  categories: string[];
  persons: string[];
  addCard: (card: Card) => void;
  updateCard: (card: Card) => void;
  deleteCard: (id: string) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addRepayment: (repayment: Repayment) => void;
  updateRepayment: (repayment: Repayment) => void;
  deleteRepayment: (id: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  addMerchant: (merchant: string) => void;
  addCategory: (category: string) => void;
  addPerson: (person: string) => void;
  loadData: () => Promise<void>;
  setState: (newState: Partial<AppState>) => void;
}

export const useStore = create<AppState>((set) => ({
  cards: [],
  transactions: [],
  repayments: [],
  settings: {
    currency: "₹",
    notificationTimes: {
      dueDate: "09:00",
      owedMoney: "09:00",
      billEmi: "09:00",
    },
    sync: { local: false, cloud: false },
  },
  merchants: [],
  categories: [],
  persons: [],
  addCard: (card: Card) =>
    set((state: AppState) => {
      const newCards = [...state.cards, card];
      saveToStorage("cards", newCards);
      return { cards: newCards };
    }),
  updateCard: (card: Card) =>
    set((state: AppState) => {
      const newCards = state.cards.map((c) => (c.id === card.id ? card : c));
      saveToStorage("cards", newCards);
      return { cards: newCards };
    }),
  deleteCard: (id: string) =>
    set((state: AppState) => {
      const newCards = state.cards.filter((c) => c.id !== id);
      saveToStorage("cards", newCards);
      return { cards: newCards };
    }),
  addTransaction: (transaction: Transaction) =>
    set((state: AppState) => {
      const newTransactions = [...state.transactions, transaction];
      saveToStorage("transactions", newTransactions);
      return { transactions: newTransactions };
    }),
  updateTransaction: (transaction: Transaction) =>
    set((state: AppState) => {
      const newTransactions = state.transactions.map((t) =>
        t.id === transaction.id ? transaction : t
      );
      saveToStorage("transactions", newTransactions);
      return { transactions: newTransactions };
    }),
  deleteTransaction: (id: string) =>
    set((state: AppState) => {
      const newTransactions = state.transactions.filter((t) => t.id !== id);
      saveToStorage("transactions", newTransactions);
      return { transactions: newTransactions };
    }),
  addRepayment: (repayment: Repayment) =>
    set((state: AppState) => {
      const newRepayments = [...state.repayments, repayment];
      saveToStorage("repayments", newRepayments);
      return { repayments: newRepayments };
    }),
  updateRepayment: (repayment: Repayment) =>
    set((state: AppState) => {
      const newRepayments = state.repayments.map((r) =>
        r.id === repayment.id ? repayment : r
      );
      saveToStorage("repayments", newRepayments);
      return { repayments: newRepayments };
    }),
  deleteRepayment: (id: string) =>
    set((state: AppState) => {
      const newRepayments = state.repayments.filter((r) => r.id !== id);
      saveToStorage("repayments", newRepayments);
      return { repayments: newRepayments };
    }),
  updateSettings: (settings: Partial<Settings>) =>
    set((state: AppState) => {
      const newSettings = { ...state.settings, ...settings };
      saveToStorage("settings", newSettings);
      return { settings: newSettings };
    }),
  addMerchant: (merchant: string) =>
    set((state: AppState) => {
      if (!state.merchants.includes(merchant)) {
        const newMerchants = [...state.merchants, merchant];
        saveToStorage("merchants", newMerchants);
        return { merchants: newMerchants };
      }
      return state;
    }),
  addCategory: (category: string) =>
    set((state: AppState) => {
      if (!state.categories.includes(category)) {
        const newCategories = [...state.categories, category];
        saveToStorage("categories", newCategories);
        return { categories: newCategories };
      }
      return state;
    }),
  addPerson: (person: string) =>
    set((state: AppState) => {
      if (!state.persons.includes(person)) {
        const newPersons = [...state.persons, person];
        saveToStorage("persons", newPersons);
        return { persons: newPersons };
      }
      return state;
    }),
  loadData: async () => {
    try {
      console.log("Loading data from storage...");
      const cards = await loadFromStorage<Card[]>("cards", []);
      if (!Array.isArray(cards)) throw new Error("Invalid cards data");
      const transactions = await loadFromStorage<Transaction[]>(
        "transactions",
        []
      );
      if (!Array.isArray(transactions))
        throw new Error("Invalid transactions data");
      const repayments = await loadFromStorage<Repayment[]>("repayments", []);
      if (!Array.isArray(repayments))
        throw new Error("Invalid repayments data");
      const settings = await loadFromStorage<Settings>("settings", {
        currency: "₹",
        notificationTimes: {
          dueDate: "09:00",
          owedMoney: "09:00",
          billEmi: "09:00",
        },
        sync: { local: false, cloud: false },
      });
      const merchants = await loadFromStorage<string[]>("merchants", []);
      if (!Array.isArray(merchants)) throw new Error("Invalid merchants data");
      const categories = await loadFromStorage<string[]>("categories", []);
      if (!Array.isArray(categories))
        throw new Error("Invalid categories data");
      const persons = await loadFromStorage<string[]>("persons", []);
      if (!Array.isArray(persons)) throw new Error("Invalid persons data");
      set({
        cards,
        transactions,
        repayments,
        settings,
        merchants,
        categories,
        persons,
      });
      console.log("Data loaded successfully");
    } catch (error: any) {
      console.error("loadData error:", error.message, error.stack);
      set({
        cards: [],
        transactions: [],
        repayments: [],
        settings: {
          currency: "₹",
          notificationTimes: {
            dueDate: "09:00",
            owedMoney: "09:00",
            billEmi: "09:00",
          },
          sync: { local: false, cloud: false },
        },
        merchants: [],
        categories: [],
        persons: [],
      });
    }
  },
  setState: (newState: Partial<AppState>) =>
    set((state: AppState) => {
      const updatedState = { ...state, ...newState };
      if (newState.cards) saveToStorage("cards", newState.cards);
      if (newState.transactions)
        saveToStorage("transactions", newState.transactions);
      if (newState.repayments) saveToStorage("repayments", newState.repayments);
      if (newState.settings) saveToStorage("settings", newState.settings);
      if (newState.merchants) saveToStorage("merchants", newState.merchants);
      if (newState.categories) saveToStorage("categories", newState.categories);
      if (newState.persons) saveToStorage("persons", newState.persons);
      return updatedState;
    }),
}));
