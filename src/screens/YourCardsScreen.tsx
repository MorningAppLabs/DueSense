import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import moment from "moment";
import { useStore } from "../store/store";
import { Card, CashbackRule, Category } from "../types/types";
import ProgressBar from "../components/ProgressBar";
import {
  getCategoryIconFull,
  DEFAULT_CATEGORIES,
  ICON_PICKER_OPTIONS,
} from "../constants/categoryIcons";
import {
  getUnbilledAmount,
  formatAmount,
  getDaysUntilDue,
} from "../utils/billingUtils";
import {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  RADIUS,
  SHADOWS,
  getCardColor,
} from "../theme/theme";

// Network options
const NETWORKS = ["Visa", "Mastercard", "RuPay", "Amex", "Diners", "Other"] as const;
const CARD_COLORS = [
  "#4361EE","#E63946","#2EC4B6","#F59E0B","#8338EC",
  "#FB5607","#06B6D4","#22C55E","#FF006E","#3A86FF",
];

const getDaysUntilAnnualFee = (annualFeeDate: string): number => {
  const [mm, dd] = annualFeeDate.split("-").map(Number);
  if (!mm || !dd) return 999;
  const today = moment();
  const thisYear = moment({ year: today.year(), month: mm - 1, date: dd });
  const candidate = thisYear.isSameOrAfter(today, "day") ? thisYear : thisYear.add(1, "year");
  return candidate.diff(today, "days");
};

const AnnualFeeBadge: React.FC<{ card: Card; currency: string; yearlySpent?: number }> = ({ card, currency, yearlySpent }) => {
  if (!card.annualFee || !card.annualFeeDate) return null;
  const days = getDaysUntilAnnualFee(card.annualFeeDate);
  const urgent = days <= 30;
  const hasWaiver = (card.annualFeeWaiverThreshold ?? 0) > 0;
  const waiverReached = hasWaiver && (yearlySpent ?? 0) >= card.annualFeeWaiverThreshold!;
  return (
    <View style={{ gap: 4 }}>
      <View style={[annualFeeStyles.badge, urgent ? annualFeeStyles.badgeUrgent : annualFeeStyles.badgeNormal]}>
        <Feather name="alert-circle" size={11} color={urgent ? COLORS.danger : COLORS.textMuted} />
        <Text style={[annualFeeStyles.badgeTxt, { color: urgent ? COLORS.danger : COLORS.textMuted }]}>
          Annual fee {formatAmount(card.annualFee, currency)}
          {" · "}
          {days === 0 ? "due today" : days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
        </Text>
      </View>
      {hasWaiver && (
        <View style={[annualFeeStyles.badge, waiverReached ? annualFeeStyles.badgeWaived : annualFeeStyles.badgeNormal]}>
          <Feather name={waiverReached ? "check-circle" : "target"} size={11} color={waiverReached ? COLORS.success : COLORS.textMuted} />
          <Text style={[annualFeeStyles.badgeTxt, { color: waiverReached ? COLORS.success : COLORS.textMuted }]}>
            {waiverReached
              ? "Fee waiver reached ✓"
              : `Spend ${formatAmount(card.annualFeeWaiverThreshold! - (yearlySpent ?? 0), currency)} more to waive fee`}
          </Text>
        </View>
      )}
    </View>
  );
};

const annualFeeStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  badgeNormal: { backgroundColor: COLORS.borderLight },
  badgeUrgent: { backgroundColor: COLORS.dangerLight },
  badgeWaived: { backgroundColor: COLORS.successLight },
  badgeTxt: { fontFamily: "Inter_700Bold", fontSize: 10 },
});

const EMPTY_CARD: Partial<Card> = {
  name: "",
  billingCycle: { start: 1, end: 30 },
  limit: 0,
  cashbackRules: [],
  dueDate: undefined,
  color: undefined,
  lastFourDigits: "",
  network: undefined,
  annualFee: undefined,
  annualFeeDate: undefined,
  annualFeeWaiverThreshold: undefined,
};

const YourCardsScreen: React.FC = () => {
  const { cards, transactions, repayments, settings, addCard, updateCard, deleteCard,
          categories, addCategory } = useStore();

  // Merge + sort alphabetically; "Others" always last
  const allCategories = useMemo<Category[]>(() => {
    const customNames = new Set(categories.map((c) => c.name.toLowerCase()));
    const builtIn = DEFAULT_CATEGORIES.filter((d) => !customNames.has(d.name.toLowerCase()));
    const all = [...builtIn, ...categories];
    const rest = all.filter((c) => c.name !== "Others").sort((a, b) => a.name.localeCompare(b.name));
    const others = all.filter((c) => c.name === "Others");
    return [...rest, ...others];
  }, [categories]);

  // Card form modal
  const [formVisible, setFormVisible] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [form, setForm] = useState<Partial<Card>>({ ...EMPTY_CARD });

  // Cashback rule form
  const [ruleModal, setRuleModal] = useState(false);
  const [editingRuleIdx, setEditingRuleIdx] = useState<number | null>(null);
  const [rule, setRule] = useState<CashbackRule>({
    onlineOffline: "Both",
    paymentType: "Full Payment",
    merchant: "",
    percentage: 1,
    categories: [],
  });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);

  // Add-category mini-modal (shown inside rule modal)
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("tag");

  const openAddCard = () => {
    setEditingCard(null);
    setForm({ ...EMPTY_CARD, cashbackRules: [] });
    setFormVisible(true);
  };

  const openEditCard = (card: Card) => {
    setEditingCard(card);
    setForm({ ...card });
    setFormVisible(true);
  };

  const saveCard = () => {
    if (!form.name?.trim()) return Alert.alert("Error", "Card name is required.");
    const limit = Number(form.limit);
    if (!limit || limit <= 0) return Alert.alert("Error", "Enter a valid credit limit.");
    const start = Number(form.billingCycle?.start ?? 1);
    const end = Number(form.billingCycle?.end ?? 30);
    if (start < 1 || start > 31 || end < 1 || end > 31)
      return Alert.alert("Error", "Billing cycle days must be 1–31.");
    const card: Card = {
      id: editingCard?.id ?? Crypto.randomUUID(),
      name: form.name.trim(),
      billingCycle: { start, end },
      limit,
      cashbackRules: form.cashbackRules ?? [],
      dueDate: form.dueDate ? Number(form.dueDate) : undefined,
      color: form.color,
      lastFourDigits: form.lastFourDigits?.trim() || undefined,
      network: form.network,
      annualFee: form.annualFee ? Number(form.annualFee) : undefined,
      annualFeeDate: form.annualFeeDate?.trim() || undefined,
      annualFeeWaiverThreshold: form.annualFeeWaiverThreshold ? Number(form.annualFeeWaiverThreshold) : undefined,
    };
    if (editingCard) updateCard(card);
    else addCard(card);
    setFormVisible(false);
  };

  const confirmDelete = (card: Card) => setDeleteTarget(card);
  const execDelete = () => {
    if (!deleteTarget) return;
    deleteCard(deleteTarget.id);
    setDeleteTarget(null);
  };

  // Rule helpers
  const openAddRule = () => {
    setEditingRuleIdx(null);
    setRule({ onlineOffline: "Both", paymentType: "Full Payment", merchant: "", percentage: 1, categories: [] });
    setRuleModal(true);
  };
  const openEditRule = (idx: number) => {
    const existing = form.cashbackRules?.[idx];
    if (!existing) return;
    setEditingRuleIdx(idx);
    setRule({ ...existing, categories: [...existing.categories] });
    setRuleModal(true);
  };
  const saveRule = () => {
    if (rule.percentage <= 0) return Alert.alert("Error", "Percentage must be > 0.");
    const rules = [...(form.cashbackRules ?? [])];
    if (editingRuleIdx !== null) rules[editingRuleIdx] = { ...rule };
    else rules.push({ ...rule });
    setForm((f) => ({ ...f, cashbackRules: rules }));
    setRuleModal(false);
  };
  const deleteRule = (idx: number) => {
    const rules = (form.cashbackRules ?? []).filter((_, i) => i !== idx);
    setForm((f) => ({ ...f, cashbackRules: rules }));
  };
  const saveNewCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    const exists = allCategories.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      addCategory({ name, icon: newCatIcon });
    }
    // Auto-select in the current rule
    setRule((r) => ({
      ...r,
      categories: r.categories.includes(name) ? r.categories : [...r.categories, name],
    }));
    setNewCatName("");
    setNewCatIcon("tag");
    setCatFormOpen(false);
  };

  const toggleRuleCategory = (cat: string) => {
    const has = rule.categories.includes(cat);
    setRule((r) => ({
      ...r,
      categories: has ? r.categories.filter((c) => c !== cat) : [...r.categories, cat],
    }));
  };

  const CardChip = ({ label, icon, active, onPress }: { label: string; icon?: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {icon ? (
        <Feather name={icon as any} size={12} color={active ? COLORS.textInverse : COLORS.textSecondary} style={{ marginRight: 3 }} />
      ) : null}
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Your Cards</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAddCard}>
          <Feather name="plus" size={20} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {cards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="credit-card" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No cards yet</Text>
            <Text style={styles.emptyBody}>Tap + to add your first credit card.</Text>
          </View>
        ) : (
          cards.map((card: Card, idx: number) => {
            const color = getCardColor(idx, card.color);
            const unbilled = getUnbilledAmount(card, transactions, repayments);
            const daysLeft = card.dueDate != null ? getDaysUntilDue(card.dueDate) : null;
            const currentYear = new Date().getFullYear().toString();
            const yearlySpent = transactions
              .filter((t: any) => t.cardId === card.id && t.date.startsWith(currentYear))
              .reduce((sum: number, t: any) => sum + t.amount, 0);
            return (
              <View key={card.id} style={styles.cardItem}>
                <View style={[styles.accentBar, { backgroundColor: color }]} />
                <View style={styles.cardBody}>
                  {/* Top row */}
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{card.name}</Text>
                      {card.network && (
                        <View style={[styles.networkBadge, { backgroundColor: color + "22" }]}>
                          <Text style={[styles.networkTxt, { color }]}>{card.network}</Text>
                        </View>
                      )}
                      {card.lastFourDigits ? (
                        <Text style={styles.cardDigits}>•••• {card.lastFourDigits}</Text>
                      ) : null}
                    </View>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => openEditCard(card)}>
                        <Feather name="edit-2" size={15} color={COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: COLORS.dangerLight }]}
                        onPress={() => confirmDelete(card)}
                      >
                        <Feather name="trash-2" size={15} color={COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Stats row */}
                  <View style={styles.statsRow}>
                    <View style={styles.stat}>
                      <Text style={[styles.statVal, { color: COLORS.danger }]}>
                        {formatAmount(unbilled, settings.currency)}
                      </Text>
                      <Text style={styles.statLbl}>Unbilled</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={[styles.statVal, { color: COLORS.success }]}>
                        {formatAmount(Math.max(0, card.limit - unbilled), settings.currency)}
                      </Text>
                      <Text style={styles.statLbl}>Available</Text>
                    </View>
                    <View style={styles.stat}>
                      <Text style={styles.statVal}>{formatAmount(card.limit, settings.currency)}</Text>
                      <Text style={styles.statLbl}>Limit</Text>
                    </View>
                    {daysLeft !== null && (
                      <View style={styles.stat}>
                        <Text
                          style={[
                            styles.statVal,
                            {
                              color:
                                daysLeft <= 0
                                  ? COLORS.danger
                                  : daysLeft <= 5
                                  ? COLORS.warning
                                  : COLORS.success,
                            },
                          ]}
                        >
                          {daysLeft <= 0 ? "Overdue" : `${daysLeft}d`}
                        </Text>
                        <Text style={styles.statLbl}>Due</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: 2 }}>
                    <ProgressBar label="" filled={unbilled} total={card.limit} height={5} />
                  </View>

                  {/* Billing cycle + annual fee */}
                  <Text style={styles.cycleInfo}>
                    Billing cycle: {card.billingCycle.start}–{card.billingCycle.end} ·{" "}
                    {card.cashbackRules.length} cashback rule{card.cashbackRules.length !== 1 ? "s" : ""}
                  </Text>
                  {card.annualFee != null && card.annualFee > 0 && (
                    <AnnualFeeBadge card={card} currency={settings.currency} yearlySpent={yearlySpent} />
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* ── Add / Edit Card Modal ── */}
      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={() => setFormVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingCard ? "Edit Card" : "Add Card"}</Text>
                <TouchableOpacity onPress={() => setFormVisible(false)}>
                  <Feather name="x" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Basic info */}
              <Text style={styles.fieldLabel}>Card Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name ?? ""}
                onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="e.g. HDFC Millennia"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Credit Limit *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.limit ? form.limit.toString() : ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, limit: Number(v) || 0 }))}
                    placeholder="100000"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ width: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Due Date (day)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.dueDate != null ? form.dueDate.toString() : ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, dueDate: v ? Number(v) : undefined }))}
                    placeholder="5"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Annual Fee (optional)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.annualFee != null ? form.annualFee.toString() : ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, annualFee: v ? Number(v) : undefined }))}
                    placeholder="e.g. 500"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ width: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Fee Date (MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    value={form.annualFeeDate ?? ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, annualFeeDate: v }))}
                    placeholder="e.g. 03-15"
                    placeholderTextColor={COLORS.textMuted}
                    maxLength={5}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Annual Fee Waiver Threshold (optional)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={form.annualFeeWaiverThreshold != null ? form.annualFeeWaiverThreshold.toString() : ""}
                onChangeText={(v) => setForm((f) => ({ ...f, annualFeeWaiverThreshold: v ? Number(v) : undefined }))}
                placeholder="e.g. 150000 (spend this amount/yr to waive fee)"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Cycle Start Day</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.billingCycle?.start.toString() ?? "1"}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, billingCycle: { start: Number(v) || 1, end: f.billingCycle?.end ?? 30 } }))
                    }
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ width: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Cycle End Day</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.billingCycle?.end.toString() ?? "30"}
                    onChangeText={(v) =>
                      setForm((f) => ({ ...f, billingCycle: { start: f.billingCycle?.start ?? 1, end: Number(v) || 30 } }))
                    }
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Last 4 Digits</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    maxLength={4}
                    value={form.lastFourDigits ?? ""}
                    onChangeText={(v) => setForm((f) => ({ ...f, lastFourDigits: v }))}
                    placeholder="1234"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ width: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Network</Text>
                  <View style={styles.chipRowSmall}>
                    {NETWORKS.map((n) => (
                      <CardChip
                        key={n}
                        label={n}
                        active={form.network === n}
                        onPress={() => setForm((f) => ({ ...f, network: n }))}
                      />
                    ))}
                  </View>
                </View>
              </View>

              {/* Color picker */}
              <Text style={styles.fieldLabel}>Card Color</Text>
              <View style={styles.colorRow}>
                {CARD_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      form.color === c && styles.colorDotActive,
                    ]}
                    onPress={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
                {form.color && (
                  <TouchableOpacity
                    style={styles.colorClear}
                    onPress={() => setForm((f) => ({ ...f, color: undefined }))}
                  >
                    <Feather name="x" size={14} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Cashback rules */}
              <View style={styles.ruleHeader}>
                <Text style={styles.fieldLabel}>Cashback Rules ({form.cashbackRules?.length ?? 0})</Text>
                <TouchableOpacity onPress={openAddRule} style={styles.addRuleBtn}>
                  <Feather name="plus" size={14} color={COLORS.primary} />
                  <Text style={styles.addRuleTxt}>Add Rule</Text>
                </TouchableOpacity>
              </View>
              {(form.cashbackRules ?? []).map((r, i) => (
                <View key={i} style={styles.ruleItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rulePct}>{r.percentage}% cashback</Text>
                    <Text style={styles.ruleSub}>
                      {r.categories.length > 0 ? r.categories.join(", ") : "All categories"} ·{" "}
                      {r.onlineOffline} · {r.paymentType}
                      {r.merchant ? ` · ${r.merchant}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openEditRule(i)} style={styles.ruleBtn}>
                    <Feather name="edit-2" size={13} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteRule(i)}
                    style={[styles.ruleBtn, { backgroundColor: COLORS.dangerLight }]}
                  >
                    <Feather name="trash-2" size={13} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Save button */}
              <TouchableOpacity style={styles.saveBtn} onPress={saveCard}>
                <Text style={styles.saveTxt}>{editingCard ? "Save Changes" : "Add Card"}</Text>
              </TouchableOpacity>
              <View style={{ height: SPACING.lg }} />
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Cashback Rule Modal ── */}
      <Modal visible={ruleModal} animationType="slide" transparent onRequestClose={() => setRuleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingRuleIdx !== null ? "Edit Rule" : "Add Rule"}</Text>
                <TouchableOpacity onPress={() => setRuleModal(false)}>
                  <Feather name="x" size={22} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Cashback %</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={rule.percentage.toString()}
                onChangeText={(v) => setRule((r) => ({ ...r, percentage: Number(v) || 0 }))}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.fieldLabel}>Limit (cap) – optional</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={rule.limit?.toString() ?? ""}
                onChangeText={(v) => setRule((r) => ({ ...r, limit: v ? Number(v) : undefined }))}
                placeholder="No cap"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.fieldLabel}>Specific Merchant – optional</Text>
              <TextInput
                style={styles.input}
                value={rule.merchant}
                onChangeText={(v) => setRule((r) => ({ ...r, merchant: v }))}
                placeholder="All merchants"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.fieldLabel}>Online / Offline</Text>
              <View style={styles.chipRow}>
                {(["Both", "Online", "Offline"] as const).map((opt) => (
                  <CardChip
                    key={opt}
                    label={opt}
                    active={rule.onlineOffline === opt}
                    onPress={() => setRule((r) => ({ ...r, onlineOffline: opt }))}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Payment Type</Text>
              <View style={styles.chipRow}>
                {(["Full Payment", "EMI"] as const).map((opt) => (
                  <CardChip
                    key={opt}
                    label={opt}
                    active={rule.paymentType === opt}
                    onPress={() => setRule((r) => ({ ...r, paymentType: opt }))}
                  />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Categories (leave blank = all)</Text>
              <View style={styles.chipRow}>
                {allCategories.map((cat) => (
                  <CardChip
                    key={cat.name}
                    label={cat.name}
                    icon={getCategoryIconFull(cat.name, categories)}
                    active={rule.categories.includes(cat.name)}
                    onPress={() => toggleRuleCategory(cat.name)}
                  />
                ))}
              </View>

              {/* Add new category inline */}
              {!catFormOpen ? (
                <TouchableOpacity
                  style={styles.addCatBtn}
                  onPress={() => setCatFormOpen(true)}
                >
                  <Feather name="plus-circle" size={14} color={COLORS.primary} />
                  <Text style={styles.addCatTxt}>Add New Category</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.catFormBox}>
                  <Text style={[styles.fieldLabel, { marginTop: 0 }]}>New Category Name</Text>
                  <TextInput
                    style={styles.input}
                    value={newCatName}
                    onChangeText={setNewCatName}
                    placeholder="e.g. Investment, Rent…"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                    autoFocus
                  />
                  <Text style={[styles.fieldLabel]}>Choose Icon</Text>
                  <View style={styles.iconPickerGrid}>
                    {ICON_PICKER_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.icon}
                        style={[
                          styles.iconPickerItem,
                          newCatIcon === opt.icon && styles.iconPickerItemActive,
                        ]}
                        onPress={() => setNewCatIcon(opt.icon as string)}
                      >
                        <Feather
                          name={opt.icon}
                          size={15}
                          color={newCatIcon === opt.icon ? COLORS.primary : COLORS.textSecondary}
                        />
                        <Text
                          style={[
                            styles.iconPickerLbl,
                            newCatIcon === opt.icon && { color: COLORS.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.catFormBtns}>
                    <TouchableOpacity
                      style={styles.catCancelBtn}
                      onPress={() => { setCatFormOpen(false); setNewCatName(""); setNewCatIcon("tag"); }}
                    >
                      <Text style={styles.catCancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { flex: 1, marginTop: 0 }]}
                      onPress={saveNewCategory}
                    >
                      <Text style={styles.saveTxt}>Add Category</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.saveBtn} onPress={saveRule}>
                <Text style={styles.saveTxt}>Save Rule</Text>
              </TouchableOpacity>
              <View style={{ height: SPACING.lg }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal visible={deleteTarget !== null} animationType="fade" transparent onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, styles.deleteBox]}>
            <View style={styles.deleteIcon}>
              <Feather name="trash-2" size={26} color={COLORS.danger} />
            </View>
            <Text style={styles.deleteTitle}>Delete "{deleteTarget?.name}"?</Text>
            <Text style={styles.deleteBody}>
              This will also delete all transactions and repayments associated with this card. This action cannot be undone.
            </Text>
            <View style={styles.deleteBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={execDelete}>
                <Text style={styles.deleteConfirmTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  screenTitle: { ...TYPOGRAPHY.h2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },
  container: { padding: SPACING.md },

  emptyBox: {
    alignItems: "center",
    paddingVertical: SPACING.xl * 2,
    gap: SPACING.sm,
  },
  emptyTitle: { ...TYPOGRAPHY.h3, color: COLORS.textSecondary },
  emptyBody: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: "center" },

  cardItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  accentBar: { width: 5 },
  cardBody: { flex: 1, padding: SPACING.md },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  cardTitleRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACING.xs },
  cardName: { ...TYPOGRAPHY.bodyBold },
  networkBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
  },
  networkTxt: { ...TYPOGRAPHY.micro, fontWeight: "700" },
  cardDigits: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
  cardActions: { flexDirection: "row", gap: SPACING.xs, flexShrink: 0 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", marginBottom: SPACING.xs },
  stat: { flex: 1 },
  statVal: { ...TYPOGRAPHY.bodyBold, fontSize: 12 },
  statLbl: { ...TYPOGRAPHY.micro, marginTop: 1 },
  cycleInfo: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: SPACING.xs },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    maxHeight: "92%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    marginBottom: SPACING.sm,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { ...TYPOGRAPHY.h3 },
  fieldLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  row: { flexDirection: "row" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginBottom: SPACING.sm },
  chipRowSmall: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: SPACING.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { ...TYPOGRAPHY.caption },
  chipTxtActive: { color: COLORS.textInverse },

  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginBottom: SPACING.md },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: { borderColor: COLORS.text, transform: [{ scale: 1.2 }] },
  colorClear: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  addRuleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
  },
  addRuleTxt: { ...TYPOGRAPHY.caption, color: COLORS.primary },
  ruleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    gap: SPACING.xs,
  },
  rulePct: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },
  ruleSub: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 1 },
  ruleBtn: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  saveTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },

  // Add-category UI
  addCatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    alignSelf: "flex-start",
  },
  addCatTxt: { ...TYPOGRAPHY.caption, color: COLORS.primary },
  catFormBox: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: SPACING.sm,
  },
  iconPickerItem: {
    width: 56,
    alignItems: "center",
    padding: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 2,
  },
  iconPickerItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  iconPickerLbl: {
    ...TYPOGRAPHY.micro,
    fontSize: 8,
    color: COLORS.textMuted,
    textAlign: "center",
  },
  catFormBtns: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  catCancelBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  catCancelTxt: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },

  // Delete modal
  deleteBox: { borderRadius: RADIUS.xxl, margin: SPACING.lg, padding: SPACING.lg, alignItems: "center" },
  deleteIcon: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.dangerLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  deleteTitle: { ...TYPOGRAPHY.h3, marginBottom: SPACING.xs, textAlign: "center" },
  deleteBody: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, textAlign: "center", marginBottom: SPACING.md },
  deleteBtns: { flexDirection: "row", gap: SPACING.sm, width: "100%" },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
  deleteConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteConfirmTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },
});

export default YourCardsScreen;

