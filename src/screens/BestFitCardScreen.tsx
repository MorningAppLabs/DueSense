import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useStore } from "../store/store";
import { Card, Transaction, Category } from "../types/types";
import ProgressBar from "../components/ProgressBar";
import { formatAmount } from "../utils/billingUtils";
import { getCategoryIconFull, DEFAULT_CATEGORIES } from "../constants/categoryIcons";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";

type RootStackParamList = { BestFitCard: undefined };
type NavProp = NativeStackNavigationProp<RootStackParamList>;

type PaymentType = "online" | "offline" | "both";

interface CardResult {
  card: Card;
  index: number;
  cashback: number;
  available: number;
  utilization: number;
  reasons: string[];
}

const BestFitCardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { cards, transactions, repayments, settings, categories } = useStore();

  const [amount, setAmountRaw] = useState<string>("1000");
  const [category, setCategory] = useState("Others");
  const [paymentType, setPaymentType] = useState<PaymentType>("both");
  const [isOnline, setIsOnline] = useState(true);
  const [showCustom, setShowCustom] = useState(false);
  const [customInputValue, setCustomInputValue] = useState("");

  // Merge + sort alphabetically; "Others" always last
  const allCategories = useMemo<Category[]>(() => {
    const customNames = new Set(categories.map((c) => c.name.toLowerCase()));
    const builtIn = DEFAULT_CATEGORIES.filter((d) => !customNames.has(d.name.toLowerCase()));
    const all = [...builtIn, ...categories];
    const rest = all.filter((c) => c.name !== "Others").sort((a, b) => a.name.localeCompare(b.name));
    const others = all.filter((c) => c.name === "Others");
    return [...rest, ...others];
  }, [categories]);

  const amountNum = Number(amount) || 0;

  const results = useMemo<CardResult[]>(() => {
    return cards
      .map((card: Card, idx: number) => {
        // Available credit
        const spent = transactions
          .filter((t: Transaction) => t.cardId === card.id)
          .reduce((s: number, t: Transaction) => s + t.amount, 0);
        const repaid = repayments
          .filter((r: any) => r.cardId === card.id)
          .reduce((s: number, r: any) => s + r.amount, 0);
        const outstanding = Math.max(0, spent - repaid);
        const available = Math.max(0, card.limit - outstanding);
        const utilization = card.limit > 0 ? (outstanding / card.limit) * 100 : 0;

        // Cashback estimation using real CashbackRule structure
        let cashback = 0;
        const reasons: string[] = [];
        const rules = card.cashbackRules ?? [];
        if (rules.length > 0) {
          let best = 0;
          const txOnlineOffline = isOnline ? "Online" : "Offline";
          for (const rule of rules) {
            // category filter
            if (rule.categories && rule.categories.length > 0) {
              const matches = rule.categories.some(
                (c: string) => c.toLowerCase() === category.toLowerCase()
              );
              if (!matches) continue;
            }
            // online/offline filter
            if (rule.onlineOffline !== "Both" && rule.onlineOffline !== txOnlineOffline) continue;
            if (rule.percentage > best) best = rule.percentage;
          }
          if (best > 0) {
            cashback = (amountNum * best) / 100;
            reasons.push(`${best}% on ${category}`);
          }
        }

        return { card, index: idx, cashback, available, utilization, reasons };
      })
      .filter((r: CardResult) => r.available >= amountNum)
      .sort((a: CardResult, b: CardResult) => {
        if (b.cashback !== a.cashback) return b.cashback - a.cashback;
        return a.utilization - b.utilization;
      });
  }, [cards, transactions, repayments, amount, category, isOnline]);

  const unfitCards = useMemo<CardResult[]>(() => {
    return cards.map((card: Card, idx: number) => {
      const spent = transactions
        .filter((t: Transaction) => t.cardId === card.id)
        .reduce((s: number, t: Transaction) => s + t.amount, 0);
      const repaid = repayments
        .filter((r: any) => r.cardId === card.id)
        .reduce((s: number, r: any) => s + r.amount, 0);
      const outstanding = Math.max(0, spent - repaid);
      const available = Math.max(0, card.limit - outstanding);
      const utilization = card.limit > 0 ? (outstanding / card.limit) * 100 : 0;
      return { card, index: idx, cashback: 0, available, utilization, reasons: [] };
    }).filter((r: CardResult) => r.available < amountNum);
  }, [cards, transactions, repayments, amount]);

  const Chip = ({ label, icon, active, onPress, color }: { label: string; icon?: string; active: boolean; onPress: () => void; color?: string }) => (
    <TouchableOpacity
      style={[styles.chip, active && { backgroundColor: color ?? COLORS.primary, borderColor: color ?? COLORS.primary }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon ? (
        <Feather name={icon as any} size={13} color={active ? COLORS.textInverse : COLORS.textSecondary} style={{ marginRight: 4 }} />
      ) : null}
      <Text style={[styles.chipTxt, active && { color: COLORS.textInverse }]}>{label}</Text>
    </TouchableOpacity>
  );

  const AmountBtn = ({ val }: { val: number }) => (
    <TouchableOpacity
      style={[styles.amtBtn, amountNum === val && styles.amtBtnActive]}
      onPress={() => setAmountRaw(val.toString())}
    >
      <Text style={[styles.amtBtnTxt, amountNum === val && { color: COLORS.primary }]}>
        {val >= 1000 ? val / 1000 + "K" : val.toString()}
      </Text>
    </TouchableOpacity>
  );

  const renderCard = (item: CardResult, rank: number) => {
    const c = getCardColor(item.index, item.card.color);
    const isBest = rank === 0;
    return (
      <View key={item.card.id} style={[styles.resultCard, isBest && { borderWidth: 2, borderColor: COLORS.success }]}>
        {isBest && (
          <View style={styles.bestBadge}>
            <Feather name="star" size={11} color={COLORS.textInverse} />
            <Text style={styles.bestBadgeTxt}>Best Pick</Text>
          </View>
        )}
        <View style={[styles.cardAccentBar, { backgroundColor: c }]} />
        <View style={styles.resultCardContent}>
          <View style={styles.resultTop}>
            <View>
              <Text style={styles.cardName}>{item.card.name}</Text>
              {item.card.lastFourDigits ? (
                <Text style={styles.cardDigits}>•••• {item.card.lastFourDigits}</Text>
              ) : null}
            </View>
            <View style={styles.rankCircle}>
              <Text style={styles.rankTxt}>#{rank + 1}</Text>
            </View>
          </View>

          <View style={styles.resultStats}>
            <View style={styles.resultStat}>
              <Text style={[styles.statVal, { color: COLORS.success }]}>
                {item.cashback > 0 ? formatAmount(item.cashback, settings.currency) : "—"}
              </Text>
              <Text style={styles.statLbl}>Cashback</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={[styles.statVal, { color: COLORS.primary }]}>
                {formatAmount(item.available, settings.currency)}
              </Text>
              <Text style={styles.statLbl}>Available</Text>
            </View>
            <View style={styles.resultStat}>
              <Text style={[styles.statVal, { color: item.utilization > 80 ? COLORS.danger : item.utilization > 50 ? COLORS.warning : COLORS.text }]}>
                {item.utilization.toFixed(0)}%
              </Text>
              <Text style={styles.statLbl}>Used</Text>
            </View>
          </View>

          <View style={styles.utilBar}>
            <ProgressBar label="" filled={item.utilization} total={100} height={6} />
          </View>

          {item.reasons.length > 0 && (
            <View style={styles.reasonRow}>
              <Feather name="info" size={12} color={COLORS.textMuted} />
              <Text style={styles.reasonTxt}>{item.reasons.join(" · ")}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.screenTitle}>Best Fit Card</Text>
          <Text style={styles.screenSub}>Find the optimal card for your spend</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Amount selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spend Amount</Text>
          <View style={styles.amtPresets}>
            {[500, 1000, 2000, 5000, 10000].map((v) => <AmountBtn key={v} val={v} />)}
          </View>
          <TouchableOpacity
            style={styles.customAmtBtn}
            onPress={() => {
              setCustomInputValue(amount);
              setShowCustom((v) => !v);
            }}
          >
            <Feather name="edit-2" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.chipTxt, { color: COLORS.primary }]}>
              {showCustom ? "Hide Custom" : `Custom: ${formatAmount(amountNum, settings.currency)}`}
            </Text>
          </TouchableOpacity>
          {showCustom && (
            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                keyboardType="numeric"
                value={customInputValue}
                onChangeText={setCustomInputValue}
                placeholder="Enter amount…"
                placeholderTextColor={COLORS.textMuted}
                autoFocus
              />
              <TouchableOpacity
                style={styles.customConfirmBtn}
                onPress={() => {
                  if (customInputValue && Number(customInputValue) > 0) {
                    setAmountRaw(customInputValue);
                    setShowCustom(false);
                  }
                }}
              >
                <Feather name="check" size={18} color={COLORS.textInverse} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.chipRow}>
            {allCategories.map((cat) => (
              <Chip
                key={cat.name}
                label={cat.name}
                icon={getCategoryIconFull(cat.name, categories)}
                active={cat.name === category}
                onPress={() => setCategory(cat.name)}
              />
            ))}
          </View>
        </View>

        {/* Online / Offline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Mode</Text>
          <View style={styles.chipRow}>
            <Chip label="Online" active={isOnline} onPress={() => setIsOnline(true)} />
            <Chip label="In Store" active={!isOnline} onPress={() => setIsOnline(false)} />
          </View>
        </View>

        {/* Results */}
        {cards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="credit-card" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyTxt}>No cards added yet.</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="alert-circle" size={32} color={COLORS.warning} />
            <Text style={styles.emptyTxt}>No card has enough available credit for this amount.</Text>
            <Text style={styles.emptySubTxt}>Try a smaller amount or pay off your balance first.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultsTitle}>
              {results.length} card{results.length > 1 ? "s" : ""} available
            </Text>
            {results.map((r, i) => renderCard(r, i))}
          </>
        )}

        {/* Cards with insufficient credit */}
        {unfitCards.length > 0 && (
          <>
            <Text style={[styles.resultsTitle, { color: COLORS.textMuted, marginTop: SPACING.sm }]}>
              Insufficient credit ({unfitCards.length})
            </Text>
            {unfitCards.map((r) => (
              <View key={r.card.id} style={[styles.resultCard, { opacity: 0.5 }]}>
                <View style={[styles.cardAccentBar, { backgroundColor: getCardColor(r.index, r.card.color) }]} />
                <View style={styles.resultCardContent}>
                  <View style={styles.resultTop}>
                    <Text style={styles.cardName}>{r.card.name}</Text>
                    <View style={[styles.rankCircle, { backgroundColor: COLORS.dangerLight }]}>
                      <Feather name="x" size={14} color={COLORS.danger} />
                    </View>
                  </View>
                  <Text style={styles.unavailTxt}>
                    Only {formatAmount(r.available, settings.currency)} available
                  </Text>
                </View>
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.xs,
  },
  screenTitle: { ...TYPOGRAPHY.h3 },
  screenSub: { ...TYPOGRAPHY.caption, marginTop: 1 },
  container: { padding: SPACING.md },

  section: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  sectionTitle: { ...TYPOGRAPHY.h4, marginBottom: SPACING.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginBottom: 2,
  },
  chipTxt: { ...TYPOGRAPHY.caption },
  amtPresets: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginBottom: SPACING.sm },
  amtBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  amtBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  amtBtnTxt: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },
  customAmtBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: COLORS.primaryLight,
    alignSelf: "flex-start",
  },
  customInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  customInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  customConfirmBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  resultsTitle: { ...TYPOGRAPHY.h4, marginBottom: SPACING.sm, marginTop: SPACING.xs },
  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  bestBadge: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.full,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    gap: 3,
    zIndex: 10,
  },
  bestBadgeTxt: { ...TYPOGRAPHY.micro, color: COLORS.textInverse, fontWeight: "700" },
  cardAccentBar: { width: 5 },
  resultCardContent: { flex: 1, padding: SPACING.md },
  resultTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  cardName: { ...TYPOGRAPHY.bodyBold },
  cardDigits: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 1 },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTxt: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: "700" },
  resultStats: { flexDirection: "row", marginBottom: SPACING.sm },
  resultStat: { flex: 1 },
  statVal: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },
  statLbl: { ...TYPOGRAPHY.micro, marginTop: 1 },
  utilBar: { marginBottom: SPACING.xs },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  reasonTxt: { ...TYPOGRAPHY.micro, flex: 1, flexWrap: "wrap" },
  unavailTxt: { ...TYPOGRAPHY.caption, color: COLORS.danger },

  emptyBox: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  emptyTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
  emptySubTxt: { ...TYPOGRAPHY.caption, textAlign: "center", paddingHorizontal: SPACING.lg },
});

export default BestFitCardScreen;

