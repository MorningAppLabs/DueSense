import { create } from "zustand";
import { Card, Transaction, Repayment, Settings, Subscription, Category } from "../types/types";
import { saveToStorage, loadFromStorage } from "../utils/storage";
import { scheduleOwedMoneyReminder, scheduleSubscriptionReminder, cancelNotificationById } from "../utils/notifications";
import { getCategoryIcon } from "../constants/categoryIcons";

interface AppState {
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
  setState: (newState: Partial<AppState>) => void;
}

export const useStore = create<AppState>((set, get) => ({
  cards: [],
  transactions: [],
  repayments: [],
  subscriptions: [],
  settings: {
    currency: "₹",
    notificationTimes: {
      dueDate: "09:00",
      owedMoney: "09:00",
      billEmi: "09:00",
      subscription: "09:00",
    },
    sync: { local: false, cloud: false },
    biometricEnabled: false,
  },
  merchants: [],
  categories: [],
  persons: [],
  notificationIds: {},
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
      const newTransactions = state.transactions.filter((t) => t.cardId !== id);
      const newRepayments = state.repayments.filter((r) => r.cardId !== id);
      saveToStorage("cards", newCards);
      saveToStorage("transactions", newTransactions);
      saveToStorage("repayments", newRepayments);
      return { cards: newCards, transactions: newTransactions, repayments: newRepayments };
    }),
  addTransaction: (transaction: Transaction) => {
    set((state: AppState) => {
      const newTransactions = [...state.transactions, transaction];
      saveToStorage("transactions", newTransactions);
      return { transactions: newTransactions };
    });

    // Schedule owed money reminder and persist the notification ID
    if (transaction.forWhom === "Someone Else" && !transaction.repaid) {
      const state = get();
      const card = state.cards.find((c) => c.id === transaction.cardId);
      if (card && transaction.personName) {
        // Cancel any existing notification for this transaction first
        const existingId = state.notificationIds["owedMoney_" + transaction.id];
        if (existingId) cancelNotificationById(existingId).catch(() => {});

        scheduleOwedMoneyReminder(
          transaction.personName,
          transaction.amount,
          new Date(transaction.date),
          transaction.id,
          state.settings.notificationTimes.owedMoney
        ).then((identifier) => {
          if (identifier) {
            set((s: AppState) => {
              const newIds = { ...s.notificationIds, ["owedMoney_" + transaction.id]: identifier };
              saveToStorage("notificationIds", newIds);
              return { notificationIds: newIds };
            });
          }
        }).catch(() => {});
      }
    }
  },
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
  addSubscription: (subscription: Subscription) => {
    set((state: AppState) => {
      const newSubscriptions = [...state.subscriptions, subscription];
      saveToStorage("subscriptions", newSubscriptions);
      return { subscriptions: newSubscriptions };
    });
    // Schedule billing date notification if active
    if (subscription.active) {
      const state = get();
      scheduleSubscriptionReminder(
        subscription.name,
        new Date(subscription.nextBillingDate),
        state.settings.notificationTimes.subscription ?? "09:00"
      ).then((identifier) => {
        if (identifier) {
          set((s: AppState) => {
            const newIds = { ...s.notificationIds, [`subscription_${subscription.id}`]: identifier };
            saveToStorage("notificationIds", newIds);
            return { notificationIds: newIds };
          });
        }
      }).catch(() => {});
    }
  },
  updateSubscription: (subscription: Subscription) => {
    set((state: AppState) => {
      const newSubscriptions = state.subscriptions.map((s) =>
        s.id === subscription.id ? subscription : s
      );
      saveToStorage("subscriptions", newSubscriptions);
      return { subscriptions: newSubscriptions };
    });
    // Cancel old notification, schedule new if still active
    const state = get();
    const existingId = state.notificationIds[`subscription_${subscription.id}`];
    if (existingId) cancelNotificationById(existingId).catch(() => {});
    if (subscription.active) {
      scheduleSubscriptionReminder(
        subscription.name,
        new Date(subscription.nextBillingDate),
        state.settings.notificationTimes.subscription ?? "09:00"
      ).then((identifier) => {
        if (identifier) {
          set((s: AppState) => {
            const newIds = { ...s.notificationIds, [`subscription_${subscription.id}`]: identifier };
            saveToStorage("notificationIds", newIds);
            return { notificationIds: newIds };
          });
        }
      }).catch(() => {});
    } else {
      // Remove stored ID if subscription became inactive
      set((s: AppState) => {
        const newIds = { ...s.notificationIds };
        delete newIds[`subscription_${subscription.id}`];
        saveToStorage("notificationIds", newIds);
        return { notificationIds: newIds };
      });
    }
  },
  deleteSubscription: (id: string) => {
    set((state: AppState) => {
      const newSubscriptions = state.subscriptions.filter((s) => s.id !== id);
      saveToStorage("subscriptions", newSubscriptions);
      return { subscriptions: newSubscriptions };
    });
    // Cancel any scheduled notification for this subscription
    const state = get();
    const existingId = state.notificationIds[`subscription_${id}`];
    if (existingId) {
      cancelNotificationById(existingId).catch(() => {});
      set((s: AppState) => {
        const newIds = { ...s.notificationIds };
        delete newIds[`subscription_${id}`];
        saveToStorage("notificationIds", newIds);
        return { notificationIds: newIds };
      });
    }
  },
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
  addCategory: (category: Category) =>
    set((state: AppState) => {
      const exists = state.categories.some(
        (c) => c.name.toLowerCase() === category.name.toLowerCase()
      );
      if (!exists) {
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
      // Load data from storage
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
      const rawSettings = await loadFromStorage<Settings>("settings", {
        currency: "₹",
        notificationTimes: {
          dueDate: "09:00",
          owedMoney: "09:00",
          billEmi: "09:00",
          subscription: "09:00",
        },
        sync: { local: false, cloud: false },
      });
      // Migrate older settings that may not have subscription notif time
      const settings: Settings = {
        ...rawSettings,
        notificationTimes: {
          dueDate: rawSettings.notificationTimes?.dueDate ?? "09:00",
          owedMoney: rawSettings.notificationTimes?.owedMoney ?? "09:00",
          billEmi: rawSettings.notificationTimes?.billEmi ?? "09:00",
          subscription: rawSettings.notificationTimes?.subscription ?? "09:00",
        },
      };
      const merchants = await loadFromStorage<string[]>("merchants", []);
      if (!Array.isArray(merchants)) throw new Error("Invalid merchants data");
      // ── Migrate legacy categories: string[] → Category[] ──────────────
      const rawCategories = await loadFromStorage<any[]>("categories", []);
      const categories: Category[] = Array.isArray(rawCategories)
        ? rawCategories.map((c: any) =>
            typeof c === "string"
              ? { name: c, icon: getCategoryIcon(c) }   // legacy migration
              : (c as Category)
          )
        : [];
      // ─────────────────────────────────────────────────────────────────
      const persons = await loadFromStorage<string[]>("persons", []);
      if (!Array.isArray(persons)) throw new Error("Invalid persons data");
      const notificationIds = await loadFromStorage<Record<string, string>>(
        "notificationIds",
        {}
      );
      if (typeof notificationIds !== "object")
        throw new Error("Invalid notificationIds data");
      const subscriptions = await loadFromStorage<Subscription[]>("subscriptions", []);
      set({
        cards,
        transactions,
        repayments,
        subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
        settings,
        merchants,
        categories,
        persons,
        notificationIds,
      });

    } catch (error: any) {
      set({
        cards: [],
        transactions: [],
        repayments: [],
        subscriptions: [],
        settings: {
          currency: "₹",
          notificationTimes: {
            dueDate: "09:00",
            owedMoney: "09:00",
            billEmi: "09:00",
            subscription: "09:00",
          },
          sync: { local: false, cloud: false },
          biometricEnabled: false,
        },
        merchants: [],
        categories: [],
        persons: [],
        notificationIds: {},
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
      if (newState.subscriptions) saveToStorage("subscriptions", newState.subscriptions);
      if (newState.settings) saveToStorage("settings", newState.settings);
      if (newState.merchants) saveToStorage("merchants", newState.merchants);
      if (newState.categories) saveToStorage("categories", newState.categories);
      if (newState.persons) saveToStorage("persons", newState.persons);
      if (newState.notificationIds)
        saveToStorage("notificationIds", newState.notificationIds);
      return updatedState;
    }),
}));
