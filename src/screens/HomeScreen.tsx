import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import ActionButton from "../components/ActionButton";
import ProgressBar from "../components/ProgressBar";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import moment from "moment";
import {
  getUnbilledAmount,
  getCashbackEarned,
  getTotalSpentInCycle,
  getDaysUntilDue,
  getActiveEmis,
  formatAmount,
} from "../utils/billingUtils";
import { Card, Transaction, Subscription } from "../types/types";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";

type RootStackParamList = {
  Main: undefined;
  AddSpending: undefined;
  RepayToCard: undefined;
  BestFitCard: undefined;
  Subscriptions: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { cards, transactions, repayments, settings, subscriptions } = useStore();

  const today = moment();
  const hour = today.hour();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const summaryData = useMemo(() => {
    let totalUtilized = 0;
    let totalLimit = 0;
    let totalCashback = 0;
    cards.forEach((card: Card) => {
      totalUtilized += getUnbilledAmount(card, transactions, repayments);
      totalLimit += card.limit;
      totalCashback += getCashbackEarned(card, transactions);
    });
    const owedTotal = transactions
      .filter((t: Transaction) => t.forWhom === "Someone Else" && !t.repaid)
      .reduce((sum: number, t: Transaction) => sum + t.amount, 0);
    return { totalUtilized, totalLimit, totalCashback, owedTotal };
  }, [cards, transactions, repayments]);

  const cardData = useMemo(() =>
    cards.map((card: Card, idx: number) => {
      const unbilled = getUnbilledAmount(card, transactions, repayments);
      const cashback = getCashbackEarned(card, transactions);
      const totalSpent = getTotalSpentInCycle(card, transactions);
      const color = getCardColor(idx, card.color);
      const daysUntilDue = card.dueDate != null ? getDaysUntilDue(card.dueDate) : null;
      return { card, unbilled, cashback, totalSpent, color, daysUntilDue };
    }),
  [cards, transactions, repayments]);

  const owedByPerson = useMemo(() => {
    const grouped = transactions
      .filter((t: Transaction) => t.forWhom === "Someone Else" && !t.repaid)
      .reduce((acc: Record<string, number>, t: Transaction) => {
        const name = t.personName ?? "Unknown";
        acc[name] = (acc[name] ?? 0) + t.amount;
        return acc;
      }, {});
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [transactions]);

  const activeEmis = useMemo(() => getActiveEmis(transactions), [transactions]);

  // ── Charts: monthly spend (last 6 months) ────────────────────────────────
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = moment().subtract(i, "months");
      const prefix = m.format("YYYY-MM");
      const total = transactions
        .filter((t: Transaction) => t.date.startsWith(prefix))
        .reduce((s: number, t: Transaction) => s + t.amount, 0);
      months.push({ label: m.format("MMM"), total, isCurrent: i === 0 });
    }
    return months;
  }, [transactions]);

  // ── Charts: category breakdown (last 30 days) ────────────────────────────
  const categoryData = useMemo(() => {
    const cutoff = moment().subtract(30, "days").format("YYYY-MM-DD");
    const grouped: Record<string, number> = {};
    transactions
      .filter((t: Transaction) => t.date >= cutoff)
      .forEach((t: Transaction) => {
        grouped[t.category] = (grouped[t.category] ?? 0) + t.amount;
      });
    return Object.entries(grouped)
      .map(([cat, val]) => ({ cat, val }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 5);
  }, [transactions]);

  // ── Subscriptions ─────────────────────────────────────────────────────────
  const subsMonthlyTotal = useMemo(() => {
    return subscriptions
      .filter((s: Subscription) => s.active)
      .reduce((sum: number, s: Subscription) => {
        const m = s.billingCycle === "Monthly" ? s.amount
          : s.billingCycle === "Yearly" ? s.amount / 12
          : s.billingCycle === "Quarterly" ? s.amount / 3
          : (s.amount * 52) / 12;
        return sum + m;
      }, 0);
  }, [subscriptions]);

  const activeSubsCount = useMemo(
    () => subscriptions.filter((s: Subscription) => s.active).length,
    [subscriptions]
  );

  const subsDueSoon = useMemo(
    () => subscriptions.filter((s: Subscription) => {
      if (!s.active) return false;
      const days = moment(s.nextBillingDate, "YYYY-MM-DD").diff(moment(), "days");
      return days >= 0 && days <= 7;
    }),
    [subscriptions]
  );

  // ── Annual fee alerts (due within 30 days) ────────────────────────────────
  const annualFeeAlerts = useMemo(() => {
    return cards.filter((c: Card) => {
      if (!c.annualFee || !c.annualFeeDate) return false;
      const [mm, dd] = c.annualFeeDate.split("-").map(Number);
      if (!mm || !dd) return false;
      const today = moment();
      const thisYr = moment({ year: today.year(), month: mm - 1, date: dd });
      const candidate = thisYr.isSameOrAfter(today, "day") ? thisYr : thisYr.add(1, "year");
      return candidate.diff(today, "days") <= 30;
    });
  }, [cards]);

  const utilizationPct =
    summaryData.totalLimit > 0
      ? Math.round((summaryData.totalUtilized / summaryData.totalLimit) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.brandName}>DueSense</Text>
          </View>
          <View style={styles.dateChip}>
            <Feather name="calendar" size={12} color={COLORS.primary} />
            <Text style={styles.dateText}>{today.format("DD MMM YYYY")}</Text>
          </View>
        </View>

        {/* ── Hero utilization card ───────────────────────── */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Total Credit Used</Text>
              <Text style={styles.heroAmount}>
                {formatAmount(summaryData.totalUtilized, settings.currency)}
              </Text>
              {summaryData.totalLimit > 0 && (
                <Text style={styles.heroSub}>
                  of {formatAmount(summaryData.totalLimit, settings.currency)} limit  ({utilizationPct}% utilized)
                </Text>
              )}
            </View>
            <View style={[styles.heroOrb, { backgroundColor: utilizationPct > 80 ? COLORS.danger + "30" : COLORS.primary + "20" }]}>
              <Feather
                name="credit-card"
                size={28}
                color={utilizationPct > 80 ? COLORS.danger : COLORS.primary}
              />
            </View>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={[styles.heroStatVal, { color: COLORS.success }]}>
                {formatAmount(summaryData.totalCashback, settings.currency)}
              </Text>
              <Text style={styles.heroStatLbl}>Cashback Earned</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={[styles.heroStatVal, { color: summaryData.owedTotal > 0 ? COLORS.warning : COLORS.textSecondary }]}>
                {formatAmount(summaryData.owedTotal, settings.currency)}
              </Text>
              <Text style={styles.heroStatLbl}>Owed to You</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatVal}>{cards.length}</Text>
              <Text style={styles.heroStatLbl}>Active Cards</Text>
            </View>
          </View>
        </View>

        {/* ── Quick actions ───────────────────────────────── */}
        <View style={styles.actions}>
          <ActionButton
            label="Add Spending"
            icon="plus-circle"
            color={COLORS.primary}
            onPress={() => navigation.navigate("AddSpending")}
          />
          <ActionButton
            label="Repay Card"
            icon="check-circle"
            color={COLORS.success}
            onPress={() => navigation.navigate("RepayToCard")}
          />
          <ActionButton
            label="Best Card"
            icon="star"
            color={COLORS.warning}
            onPress={() => navigation.navigate("BestFitCard")}
          />
        </View>

        {/* ── Spend Insights ──────────────────────────────── */}
        {transactions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Spend Insights</Text>
            <View style={styles.insightCard}>
              <Text style={styles.insightCardTitle}>Monthly Spending</Text>
              {/* Bar chart */}
              {(() => {
                const maxVal = Math.max(...monthlyData.map((m) => m.total), 1);
                const BAR_H = 68;
                return (
                  <View style={styles.barChartRow}>
                    {monthlyData.map((m, i) => (
                      <View key={i} style={styles.barChartItem}>
                        <Text style={styles.barValTxt}>
                          {m.total > 0
                            ? m.total >= 100000
                              ? `${(m.total / 100000).toFixed(1)}L`
                              : m.total >= 1000
                              ? `${Math.round(m.total / 1000)}k`
                              : String(Math.round(m.total))
                            : ""}
                        </Text>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: Math.max((m.total / maxVal) * BAR_H, m.total > 0 ? 4 : 1),
                              backgroundColor: m.isCurrent ? COLORS.primary : COLORS.primary + "55",
                            },
                          ]}
                        />
                        <Text style={[styles.barLblTxt, m.isCurrent && { color: COLORS.primary, fontFamily: "Inter_700Bold" }]}>
                          {m.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>

            {categoryData.length > 0 && (
              <View style={styles.insightCard}>
                <Text style={styles.insightCardTitle}>Top Categories · Last 30 Days</Text>
                {(() => {
                  const maxCat = categoryData[0]?.val ?? 1;
                  return categoryData.map(({ cat, val }, i) => (
                    <View key={cat} style={styles.catBarRow}>
                      <Text style={styles.catBarLabel} numberOfLines={1}>{cat}</Text>
                      <View style={styles.catBarTrack}>
                        <View
                          style={[
                            styles.catBarFill,
                            {
                              width: `${Math.round((val / maxCat) * 100)}%` as any,
                              backgroundColor: COLORS.cardPalette[i % COLORS.cardPalette.length] + "BB",
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.catBarVal}>{formatAmount(val, settings.currency)}</Text>
                    </View>
                  ));
                })()}
              </View>
            )}
          </>
        )}

        {/* ── Subscriptions KPI ───────────────────────────── */}
        <TouchableOpacity
          style={styles.subKpiCard}
          onPress={() => navigation.navigate("Subscriptions")}
          activeOpacity={0.88}
        >
          <View style={styles.subKpiLeft}>
            <View style={styles.subKpiIcon}>
              <Feather name="repeat" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.subKpiTitle}>Subscriptions</Text>
              {activeSubsCount === 0 ? (
                <Text style={styles.subKpiSub}>Tap to track your subscriptions</Text>
              ) : (
                <Text style={styles.subKpiSub}>
                  {activeSubsCount} active
                  {subsDueSoon.length > 0 ? ` · ${subsDueSoon.length} due this week` : ""}
                </Text>
              )}
            </View>
          </View>
          {activeSubsCount > 0 ? (
            <View style={styles.subKpiRight}>
              <Text style={[styles.subKpiAmt, { color: COLORS.danger }]}>
                {formatAmount(Math.round(subsMonthlyTotal), settings.currency)}
              </Text>
              <Text style={styles.subKpiPer}>/ month</Text>
            </View>
          ) : null}
          <Feather name="chevron-right" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* ── Annual Fee Alerts ────────────────────────────── */}
        {annualFeeAlerts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Annual Fee Due Soon</Text>
            {annualFeeAlerts.map((c: Card) => {
              const [mm, dd] = (c.annualFeeDate ?? "").split("-").map(Number);
              const today = moment();
              const thisYr = moment({ year: today.year(), month: mm - 1, date: dd });
              const candidate = thisYr.isSameOrAfter(today, "day") ? thisYr : thisYr.add(1, "year");
              const days = candidate.diff(today, "days");
              const cardIdx = cards.findIndex((x: Card) => x.id === c.id);
              const color = getCardColor(cardIdx, c.color);
              return (
                <View key={c.id} style={styles.feeAlertItem}>
                  <View style={[styles.feeAlertIcon, { backgroundColor: color + "22" }]}>
                    <Feather name="alert-circle" size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeAlertName}>{c.name}</Text>
                    <Text style={styles.feeAlertSub}>
                      Annual fee due {days === 0 ? "today" : `in ${days} day${days !== 1 ? "s" : ""}`}
                    </Text>
                  </View>
                  <Text style={[styles.feeAlertAmt, { color: days <= 7 ? COLORS.danger : COLORS.warning }]}>
                    {formatAmount(c.annualFee!, settings.currency)}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {/* ── Your Cards ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Your Cards — This Cycle</Text>
        {cards.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Feather name="credit-card" size={32} color={COLORS.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptySubText}>
              Go to the Cards tab to add your first credit card.
            </Text>
          </View>
        ) : (
          cardData.map(({ card, unbilled, cashback, totalSpent, color, daysUntilDue }) => (
            <View key={card.id} style={styles.cardItem}>
              <View style={[styles.cardAccent, { backgroundColor: color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: color + "20" }]}>
                    <Feather name="credit-card" size={16} color={color} />
                  </View>
                  <View style={styles.cardHeaderMid}>
                    <Text style={styles.cardName}>{card.name}</Text>
                    {card.lastFourDigits ? (
                      <Text style={styles.cardDigits}>···· {card.lastFourDigits}</Text>
                    ) : null}
                  </View>
                  {daysUntilDue !== null && (
                    <View style={[
                      styles.dueBadge,
                      {
                        backgroundColor:
                          daysUntilDue <= 3
                            ? COLORS.dangerLight
                            : daysUntilDue <= 7
                            ? COLORS.warningLight
                            : COLORS.successLight,
                      },
                    ]}>
                      <Feather
                        name="clock"
                        size={10}
                        color={
                          daysUntilDue <= 3
                            ? COLORS.danger
                            : daysUntilDue <= 7
                            ? COLORS.warning
                            : COLORS.success
                        }
                      />
                      <Text style={[
                        styles.dueBadgeTxt,
                        {
                          color:
                            daysUntilDue <= 3
                              ? COLORS.danger
                              : daysUntilDue <= 7
                              ? COLORS.warning
                              : COLORS.success,
                        },
                      ]}>
                        {daysUntilDue === 0
                          ? "Due today"
                          : daysUntilDue < 0
                          ? (Math.abs(daysUntilDue).toString() + "d overdue")
                          : ("Due in " + daysUntilDue.toString() + "d")}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardStatsRow}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatVal}>
                      {formatAmount(totalSpent, settings.currency)}
                    </Text>
                    <Text style={styles.cardStatLbl}>Spent</Text>
                  </View>
                  <View style={styles.cardStatDiv} />
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardStatVal, { color: COLORS.danger }]}>
                      {formatAmount(unbilled, settings.currency)}
                    </Text>
                    <Text style={styles.cardStatLbl}>Unbilled</Text>
                  </View>
                  <View style={styles.cardStatDiv} />
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardStatVal, { color: COLORS.success }]}>
                      {formatAmount(cashback, settings.currency)}
                    </Text>
                    <Text style={styles.cardStatLbl}>Cashback</Text>
                  </View>
                  <View style={styles.cardStatDiv} />
                  <View style={styles.cardStat}>
                    <Text style={styles.cardStatVal}>
                      {formatAmount(card.limit - unbilled, settings.currency)}
                    </Text>
                    <Text style={styles.cardStatLbl}>Available</Text>
                  </View>
                </View>

                <ProgressBar
                  label="Utilization"
                  filled={unbilled}
                  total={card.limit}
                  showPercentage
                  height={6}
                />
              </View>
            </View>
          ))
        )}

        {/* ── Active EMIs ─────────────────────────────────── */}
        {activeEmis.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active EMIs</Text>
            {activeEmis.map((t: Transaction) => {
              const card = cards.find((c: Card) => c.id === t.cardId);
              const cardIdx = cards.findIndex((c: Card) => c.id === t.cardId);
              const color = getCardColor(cardIdx, card?.color);
              const startDate = moment(t.date, "YYYY-MM-DD");
              const endDate = startDate.clone().add(t.emiPlan!.months, "months");
              const monthsLeft = Math.max(0, endDate.diff(moment(), "months") + 1);
              return (
                <View key={t.id} style={styles.emiItem}>
                  <View style={[styles.emiIcon, { backgroundColor: color + "20" }]}>
                    <Feather name="repeat" size={16} color={color} />
                  </View>
                  <View style={styles.emiContent}>
                    <Text style={styles.emiMerchant}>{t.merchant}</Text>
                    <Text style={styles.emiSub}>
                      {card?.name ?? "—"}
                      {" · "}
                      {t.emiPlan!.months} months
                      {t.emiPlan!.interest > 0 ? (" · " + t.emiPlan!.interest.toString() + "% p.a.") : ""}
                    </Text>
                  </View>
                  <View style={styles.emiRight}>
                    <Text style={styles.emiAmount}>
                      {formatAmount(t.emiPlan!.amount, settings.currency)}/mo
                    </Text>
                    <Text style={styles.emiLeft}>{monthsLeft} mo. left</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* ── Money Owed ──────────────────────────────────── */}
        {owedByPerson.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Money Owed to You</Text>
            {owedByPerson.map(([name, amount]) => (
              <View key={name} style={styles.owedItem}>
                <View style={styles.owedAvatar}>
                  <Text style={styles.owedAvatarTxt}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.owedName}>{name}</Text>
                <Text style={styles.owedAmount}>
                  {formatAmount(amount, settings.currency)}
                </Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { padding: SPACING.md, paddingTop: SPACING.sm },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: SPACING.md,
  },
  greeting: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  brandName: { ...TYPOGRAPHY.h1, marginTop: 2 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  dateText: { fontFamily: "Inter_700Bold", fontSize: 11, color: COLORS.primary },

  // Hero card
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.md,
  },
  heroLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  heroAmount: { ...TYPOGRAPHY.h1, marginTop: 4 },
  heroSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  heroOrb: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  heroStatItem: { flex: 1, alignItems: "center" },
  heroStatVal: { ...TYPOGRAPHY.bodyBold, fontSize: 15 },
  heroStatLbl: { ...TYPOGRAPHY.micro, marginTop: 2 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: COLORS.border },

  // Quick actions
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    minHeight: 80,
  },

  // Section
  sectionTitle: {
    ...TYPOGRAPHY.h4,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
    color: COLORS.text,
  },

  // Empty state
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    ...SHADOWS.xs,
    marginBottom: SPACING.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  emptyTitle: { ...TYPOGRAPHY.h4, color: COLORS.textSecondary },
  emptySubText: {
    ...TYPOGRAPHY.caption,
    textAlign: "center",
    marginTop: SPACING.xs,
  },

  // Card item
  cardItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  cardAccent: {
    width: 4,
    alignSelf: "stretch",
  },
  cardBody: {
    flex: 1,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderMid: { flex: 1 },
  cardName: { ...TYPOGRAPHY.h4 },
  cardDigits: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 1 },
  dueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dueBadgeTxt: { fontFamily: "Inter_700Bold", fontSize: 10 },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  cardStat: { flex: 1, alignItems: "center" },
  cardStatVal: { ...TYPOGRAPHY.bodyBold, fontSize: 12 },
  cardStatLbl: { ...TYPOGRAPHY.micro, marginTop: 1 },
  cardStatDiv: { width: 1, height: 24, backgroundColor: COLORS.border },

  // EMI
  emiItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.xs,
  },
  emiIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emiContent: { flex: 1 },
  emiMerchant: { ...TYPOGRAPHY.bodySemiBold },
  emiSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  emiRight: { alignItems: "flex-end" },
  emiAmount: { ...TYPOGRAPHY.bodyBold },
  emiLeft: { ...TYPOGRAPHY.micro, color: COLORS.info, marginTop: 2 },

  // Owed
  owedItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.xs,
  },
  owedAvatar: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.warningLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  owedAvatarTxt: { fontFamily: "Inter_700Bold", fontSize: 16, color: COLORS.warning },
  owedName: { ...TYPOGRAPHY.bodySemiBold, flex: 1 },
  owedAmount: { ...TYPOGRAPHY.bodyBold, color: COLORS.danger },

  // ── Insight charts ───────────────────────────────────────────
  insightCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  insightCardTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  barChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    height: 100,
  },
  barChartItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    marginBottom: 4,
  },
  barValTxt: {
    fontFamily: "Inter_400Regular",
    fontSize: 8,
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  barLblTxt: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  catBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  catBarLabel: {
    ...TYPOGRAPHY.caption,
    width: 80,
    color: COLORS.textSecondary,
  },
  catBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.borderLight,
    borderRadius: 4,
    overflow: "hidden",
  },
  catBarFill: {
    height: 8,
    borderRadius: 4,
  },
  catBarVal: {
    ...TYPOGRAPHY.micro,
    width: 60,
    textAlign: "right",
    color: COLORS.textSecondary,
  },

  // ── Subscription KPI ─────────────────────────────────────────
  subKpiCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  subKpiLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  subKpiIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  subKpiTitle: { ...TYPOGRAPHY.bodySemiBold },
  subKpiSub: { ...TYPOGRAPHY.micro, marginTop: 2 },
  subKpiRight: { alignItems: "flex-end", marginRight: SPACING.xs },
  subKpiAmt: { ...TYPOGRAPHY.bodyBold, fontSize: 16 },
  subKpiPer: { ...TYPOGRAPHY.micro },

  // ── Annual Fee Alerts ─────────────────────────────────────────
  feeAlertItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.xs,
  },
  feeAlertIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  feeAlertName: { ...TYPOGRAPHY.bodySemiBold },
  feeAlertSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  feeAlertAmt: { ...TYPOGRAPHY.bodyBold },
});

export default HomeScreen;

