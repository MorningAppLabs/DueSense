import moment from 'moment';
import { Card, Transaction, Repayment, CashbackRule } from '../types/types';

// ─────────────────────────────────────────────────────────────────────────────
// Core billing cycle calculation
// Returns the start and end Moment objects for the billing cycle that contains
// the given transactionDate, using the card's configured start/end days.
// ─────────────────────────────────────────────────────────────────────────────
export const getBillingCycleDates = (
  card: Card,
  transactionDate: string
): { start: moment.Moment; end: moment.Moment } => {
  const date = moment(transactionDate, 'YYYY-MM-DD');
  const year = date.year();
  const month = date.month() + 1; // 1-indexed
  const startDay = card.billingCycle.start;
  const endDay = card.billingCycle.end;

  let cycleStart: moment.Moment;
  let cycleEnd: moment.Moment;

  if (startDay <= endDay) {
    // Same-month cycle (e.g. 1 → 30)
    cycleStart = moment(`${year}-${month}-${startDay}`, 'YYYY-MM-DD');
    cycleEnd = moment(`${year}-${month}-${endDay}`, 'YYYY-MM-DD');
  } else {
    // Cross-month cycle (e.g. 25 → 24 of next month)
    cycleStart = moment(`${year}-${month}-${startDay}`, 'YYYY-MM-DD');
    cycleEnd = moment(`${year}-${month}-${endDay}`, 'YYYY-MM-DD').add(1, 'month');
  }

  // Adjust if the date falls outside the computed window
  if (date.isBefore(cycleStart)) {
    cycleStart.subtract(1, 'month');
    cycleEnd.subtract(1, 'month');
  } else if (date.isAfter(cycleEnd)) {
    cycleStart.add(1, 'month');
    cycleEnd.add(1, 'month');
  }

  return { start: cycleStart, end: cycleEnd };
};

// ─────────────────────────────────────────────────────────────────────────────
// Current billing cycle for a card (based on today)
// ─────────────────────────────────────────────────────────────────────────────
export const getCurrentBillingCycle = (
  card: Card
): { start: moment.Moment; end: moment.Moment } => {
  return getBillingCycleDates(card, moment().format('YYYY-MM-DD'));
};

// ─────────────────────────────────────────────────────────────────────────────
// Next due date for a card
// dueDay is the day-of-month the payment is due (e.g. 5 means 5th of every month)
// Returns the next upcoming due date as a Moment
// ─────────────────────────────────────────────────────────────────────────────
export const getNextDueDate = (dueDay: number): moment.Moment => {
  const today = moment();
  const thisMonth = moment().date(dueDay);

  if (today.date() <= dueDay) {
    return thisMonth;
  }
  return thisMonth.add(1, 'month');
};

// ─────────────────────────────────────────────────────────────────────────────
// Days until next due date (negative = overdue)
// ─────────────────────────────────────────────────────────────────────────────
export const getDaysUntilDue = (dueDay: number): number => {
  const next = getNextDueDate(dueDay);
  return next.diff(moment().startOf('day'), 'days');
};

// ─────────────────────────────────────────────────────────────────────────────
// Sum of transactions in a billing cycle for a card
// ─────────────────────────────────────────────────────────────────────────────
export const getUnbilledAmount = (
  card: Card,
  transactions: Transaction[],
  repayments: Repayment[],
  referenceDate?: string
): number => {
  const today = referenceDate ?? moment().format('YYYY-MM-DD');
  const { start, end } = getBillingCycleDates(card, today);

  const totalSpent = transactions
    .filter(
      (t) =>
        t.cardId === card.id &&
        moment(t.date, 'YYYY-MM-DD').isBetween(start, end, undefined, '[]')
    )
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRepaid = repayments
    .filter(
      (r) =>
        r.cardId === card.id &&
        r.billingCycleStart &&
        moment(r.billingCycleStart, 'YYYY-MM-DD').isSame(start, 'day')
    )
    .reduce((sum, r) => sum + r.amount, 0);

  return Math.max(0, totalSpent - totalRepaid);
};

// ─────────────────────────────────────────────────────────────────────────────
// Cashback earned in the current billing cycle for a card
// ─────────────────────────────────────────────────────────────────────────────
export const getCashbackEarned = (
  card: Card,
  transactions: Transaction[],
  referenceDate?: string
): number => {
  const today = referenceDate ?? moment().format('YYYY-MM-DD');
  const { start, end } = getBillingCycleDates(card, today);

  return transactions
    .filter(
      (t) =>
        t.cardId === card.id &&
        moment(t.date, 'YYYY-MM-DD').isBetween(start, end, undefined, '[]')
    )
    .reduce((sum, t) => sum + (t.cashback || 0), 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Total spent in a specific billing cycle (no repayment deduction)
// ─────────────────────────────────────────────────────────────────────────────
export const getTotalSpentInCycle = (
  card: Card,
  transactions: Transaction[],
  referenceDate?: string
): number => {
  const today = referenceDate ?? moment().format('YYYY-MM-DD');
  const { start, end } = getBillingCycleDates(card, today);

  return transactions
    .filter(
      (t) =>
        t.cardId === card.id &&
        moment(t.date, 'YYYY-MM-DD').isBetween(start, end, undefined, '[]')
    )
    .reduce((sum, t) => sum + t.amount, 0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Calculate cashback for a hypothetical transaction
// ─────────────────────────────────────────────────────────────────────────────
export const calculateTransactionCashback = (
  card: Card,
  transactions: Transaction[],
  amount: number,
  paymentType: 'Full Payment' | 'EMI',
  onlineOffline: 'Online' | 'Offline',
  merchant: string,
  category: string,
  transactionDate: string
): number => {
  if (!card.cashbackRules.length) return 0;

  const rule: CashbackRule | undefined = card.cashbackRules.find(
    (r) =>
      (r.onlineOffline === onlineOffline || r.onlineOffline === 'Both') &&
      r.paymentType === paymentType &&
      (!r.merchant || r.merchant.toUpperCase() === merchant.toUpperCase()) &&
      (!r.categories.length || r.categories.some((rc) => rc.toUpperCase() === category.toUpperCase()))
  );

  if (!rule) return 0;

  const { start, end } = getBillingCycleDates(card, transactionDate);

  // How much cashback has already been earned against this rule in the cycle
  const earned = transactions
    .filter(
      (t) =>
        t.cardId === card.id &&
        moment(t.date, 'YYYY-MM-DD').isBetween(start, end, undefined, '[]') &&
        (rule.onlineOffline === t.onlineOffline || rule.onlineOffline === 'Both') &&
        rule.paymentType === t.paymentType &&
        (!rule.merchant || rule.merchant.toUpperCase() === t.merchant.toUpperCase()) &&
        (!rule.categories.length || rule.categories.some((rc) => rc.toUpperCase() === t.category.toUpperCase()))
    )
    .reduce((sum, t) => sum + (t.cashback || 0), 0);

  const remaining = rule.limit != null ? Math.max(0, rule.limit - earned) : Infinity;
  const potential = (amount * rule.percentage) / 100;
  return Math.min(potential, remaining);
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate billing cycle dropdown options for a given card
// ─────────────────────────────────────────────────────────────────────────────
export const getBillingCycleOptions = (
  card: Card,
  transactions: Transaction[]
): { label: string; value: string }[] => {
  const today = moment();
  const currentCycle = getBillingCycleDates(card, today.format('YYYY-MM-DD'));
  const currentLabel = `Current (${currentCycle.start.format('DD MMM')} – ${currentCycle.end.format('DD MMM YYYY')})`;

  const cardTransactions = transactions.filter((t) => t.cardId === card.id);
  const cycles: { start: moment.Moment; end: moment.Moment }[] = [];

  cardTransactions.forEach((t) => {
    const cycle = getBillingCycleDates(card, t.date);
    if (!cycles.some((c) => c.start.isSame(cycle.start, 'day') && c.end.isSame(cycle.end, 'day'))) {
      cycles.push(cycle);
    }
  });

  const pastCycles = cycles
    .filter((c) => !c.start.isSame(currentCycle.start, 'day') || !c.end.isSame(currentCycle.end, 'day'))
    .sort((a, b) => b.start.diff(a.start))
    .map((c) => ({
      label: `${c.start.format('DD MMM YYYY')} – ${c.end.format('DD MMM YYYY')}`,
      value: `${c.start.format('YYYY-MM-DD')}|${c.end.format('YYYY-MM-DD')}`,
    }));

  return [{ label: currentLabel, value: 'current' }, ...pastCycles];
};

// ─────────────────────────────────────────────────────────────────────────────
// Resolve { start, end } Moment objects from a billing cycle option value
// ─────────────────────────────────────────────────────────────────────────────
export const resolveCycleRange = (
  card: Card,
  cycleValue: string
): { start: moment.Moment; end: moment.Moment } => {
  if (cycleValue === 'current') {
    return getCurrentBillingCycle(card);
  }
  const [startDate, endDate] = cycleValue.split('|');
  return {
    start: moment(startDate, 'YYYY-MM-DD'),
    end: moment(endDate, 'YYYY-MM-DD'),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Format currency amount
// ─────────────────────────────────────────────────────────────────────────────
export const formatAmount = (amount: number, currency: string): string =>
  `${currency}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─────────────────────────────────────────────────────────────────────────────
// Active EMI transactions (ongoing instalments)
// ─────────────────────────────────────────────────────────────────────────────
export const getActiveEmis = (transactions: Transaction[]): Transaction[] => {
  const today = moment();
  return transactions.filter((t) => {
    if (t.paymentType !== 'EMI' || !t.emiPlan) return false;
    const startDate = moment(t.date, 'YYYY-MM-DD');
    const endDate = startDate.clone().add(t.emiPlan.months, 'months');
    return today.isBefore(endDate);
  });
};
