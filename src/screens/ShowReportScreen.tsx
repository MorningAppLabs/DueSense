import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Dropdown from "../components/Dropdown";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import { Transaction, Card, CashbackRule } from "../types/types";
import moment from "moment";
import TransactionCard from "../components/TransactionCard";
import {
  getBillingCycleDates,
  getBillingCycleOptions,
  resolveCycleRange,
  formatAmount,
  calculateTransactionCashback,
} from "../utils/billingUtils";
import {
  scheduleDueDateReminder,
  cancelNotificationById,
  scheduleOwedMoneyReminder,
} from "../utils/notifications";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";
import { getCategoryIcon } from "../constants/categoryIcons";
import { useNavigation } from "@react-navigation/native";

const ShowReportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {
    cards,
    transactions,
    settings,
    notificationIds,
    repayments,
    merchants,
    categories,
    addMerchant,
    addCategory,
    updateTransaction,
    deleteTransaction,
  } = useStore();

  const [cardId, setCardId] = useState("");
  const [billingCycle, setBillingCycle] = useState("current");
  const [searchQuery, setSearchQuery] = useState("");
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);

  // Edit modal state
  const [editedAmount, setEditedAmount] = useState("");
  const [editedMerchant, setEditedMerchant] = useState("");
  const [useCustomMerchant, setUseCustomMerchant] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [editedCashback, setEditedCashback] = useState(0);

  const uniqueMerchants = useMemo(() => {
    // Collect merchants from store (proper casing) and rule merchants
    const all: string[] = [
      ...merchants,
      ...cards.flatMap((c) => c.cashbackRules.map((r) => r.merchant)).filter(Boolean),
    ];
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const m of all) {
      const lower = m.toLowerCase();
      if (!seen.has(lower)) { seen.add(lower); deduped.push(m); }
    }
    return deduped.sort((a, b) => a.localeCompare(b));
  }, [merchants, cards]);

  const uniqueCategories = useMemo(() => {
    // Collect categories from store (proper casing) and rule categories
    const all: string[] = [
      ...categories.map((c) => c.name),
      ...cards.flatMap((c) => c.cashbackRules.flatMap((r) => r.categories)).filter(Boolean),
    ];
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const c of all) {
      const lower = c.toLowerCase();
      if (!seen.has(lower)) { seen.add(lower); deduped.push(c); }
    }
    return deduped.sort((a, b) => a.localeCompare(b));
  }, [categories, cards]);

  const selectedCard = useMemo(() => cards.find((c: Card) => c.id === cardId), [cards, cardId]);
  const cardColor = useMemo(() => {
    const idx = cards.findIndex((c: Card) => c.id === cardId);
    return getCardColor(idx, selectedCard?.color);
  }, [cards, cardId, selectedCard]);

  const billingCycleOptions = useMemo(
    () => (selectedCard ? getBillingCycleOptions(selectedCard, transactions) : []),
    [selectedCard, transactions]
  );

  const { start: cycleStart, end: cycleEnd } = useMemo(() => {
    if (!selectedCard) return { start: moment(), end: moment() };
    return resolveCycleRange(selectedCard, billingCycle);
  }, [selectedCard, billingCycle]);

  const filteredTransactions = useMemo(() => {
    if (!cardId) return [];
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t: Transaction) => {
      if (t.cardId !== cardId) return false;
      if (!moment(t.date, "YYYY-MM-DD").isBetween(cycleStart, cycleEnd, undefined, "[]")) return false;
      if (q) {
        return (
          t.merchant.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.personName ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, cardId, cycleStart, cycleEnd, searchQuery]);

  const groupedTransactions = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    filteredTransactions.forEach((t: Transaction) => {
      if (!grouped[t.date]) grouped[t.date] = [];
      grouped[t.date].push(t);
    });
    return Object.entries(grouped).sort(([a], [b]) => moment(b).diff(moment(a)));
  }, [filteredTransactions]);

  const summary = useMemo(() => {
    const totalSpent = filteredTransactions.reduce((s: number, t: Transaction) => s + t.amount, 0);
    const totalCashback = filteredTransactions.reduce((s: number, t: Transaction) => s + (t.cashback ?? 0), 0);
    const totalRepaid = repayments
      .filter((r) => r.cardId === cardId && r.billingCycleStart && moment(r.billingCycleStart, "YYYY-MM-DD").isSame(cycleStart, "day"))
      .reduce((s, r) => s + r.amount, 0);
    const unbilled = Math.max(0, totalSpent - totalRepaid);
    const txCount = filteredTransactions.length;
    return { totalSpent, totalCashback, totalRepaid, unbilled, txCount };
  }, [filteredTransactions, repayments, cardId, cycleStart]);

  const recalcCashback = useCallback((amount: string, merchant: string, category: string) => {
    if (!selectedCard || !amount || !editTransaction) return 0;
    return calculateTransactionCashback(
      selectedCard,
      transactions.filter((t) => t.id !== editTransaction.id),
      Number(amount),
      editTransaction.paymentType,
      editTransaction.onlineOffline,
      merchant,
      category,
      editTransaction.date
    );
  }, [selectedCard, transactions, editTransaction]);

  const openEdit = (t: Transaction) => {
    setEditTransaction(t);
    setEditedAmount(t.amount.toString());
    setEditedMerchant(t.merchant);
    setUseCustomMerchant(false);
    setEditedDescription(t.description);
    setEditedCategory(t.category);
    setUseCustomCategory(false);
    setEditedCashback(t.cashback ?? 0);
  };

  const handleSaveEdit = () => {
    if (!editTransaction) return;
    if (!editedAmount || Number(editedAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (!editedMerchant || !editedDescription || !editedCategory) {
      Alert.alert("Error", "Please fill all fields.");
      return;
    }
    const merch = editedMerchant.trim();
    const cat = editedCategory.trim();
    if (useCustomMerchant && merch) addMerchant(merch);
    // Save custom category to store
    if (useCustomCategory && cat) {
      const alreadyExists = categories.some((c) => c.name.toLowerCase() === cat.toLowerCase());
      if (!alreadyExists) {
        addCategory({ name: cat, icon: getCategoryIcon(cat) });
      }
    }

    updateTransaction({
      ...editTransaction,
      amount: Number(editedAmount),
      merchant: merch,
      description: editedDescription.trim(),
      category: cat,
      cashback: editedCashback,
    });
    setEditTransaction(null);
    Alert.alert("Success", "Transaction updated.");
  };

  const handleDelete = (id: string) => {
    deleteTransaction(id);
  };

  const renderDateGroup = ({ item }: { item: [string, Transaction[]] }) => {
    const [date, txs] = item;
    return (
      <View style={styles.dateGroup}>
        <View style={styles.dateHeader}>
          <Text style={styles.dateLabel}>{moment(date, "YYYY-MM-DD").format("dddd, DD MMM YYYY")}</Text>
          <Text style={styles.dateTotalAmt}>
            {formatAmount(txs.reduce((s, t) => s + t.amount, 0), settings.currency)}
          </Text>
        </View>
        {txs.map((t) => (
          <TransactionCard
            key={t.id}
            transaction={t}
            onEdit={openEdit}
            onDelete={handleDelete}
            showCardName={false}
            showCashback
            showStatus
            showPerson
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Reports</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => navigation.navigate("ReportExport" as never)}
        >
          <Feather name="download" size={14} color={COLORS.primary} />
          <Text style={styles.exportBtnTxt}>Export PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersCard}>
        <Dropdown
          label="Card"
          placeholder="Select a card…"
          items={cards.map((c: Card) => ({ label: c.name, value: c.id }))}
          selectedValue={cardId}
          onValueChange={(v) => { setCardId(v as string); setBillingCycle("current"); }}
          searchable
        />

        {selectedCard && (
          <Dropdown
            label="Billing cycle"
            placeholder="Select cycle…"
            items={billingCycleOptions.map((o) => ({ label: o.label, value: o.value }))}
            selectedValue={billingCycle}
            onValueChange={(v) => setBillingCycle(v as string)}
            style={{ marginTop: SPACING.sm }}
          />
        )}
      </View>

      {/* Search */}
      {cardId ? (
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search merchant, description, category…"
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Feather name="x" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}

      {/* Summary */}
      {cardId && (
        <View style={[styles.summaryRow, { borderLeftColor: cardColor }]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{formatAmount(summary.totalSpent, settings.currency)}</Text>
            <Text style={styles.summaryLbl}>Spent</Text>
          </View>
          <View style={styles.summaryDiv} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.danger }]}>{formatAmount(summary.unbilled, settings.currency)}</Text>
            <Text style={styles.summaryLbl}>Unbilled</Text>
          </View>
          <View style={styles.summaryDiv} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.success }]}>{formatAmount(summary.totalCashback, settings.currency)}</Text>
            <Text style={styles.summaryLbl}>Cashback</Text>
          </View>
          <View style={styles.summaryDiv} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.primary }]}>{summary.txCount}</Text>
            <Text style={styles.summaryLbl}>Transactions</Text>
          </View>
        </View>
      )}

      {/* Transaction list */}
      {!cardId ? (
        <View style={styles.emptyState}>
          <Feather name="bar-chart-2" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>Select a card to view report</Text>
        </View>
      ) : groupedTransactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="inbox" size={48} color={COLORS.border} />
          <Text style={styles.emptyTitle}>
            {searchQuery ? "No matching transactions" : "No transactions this cycle"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={groupedTransactions}
          keyExtractor={([date]) => date}
          renderItem={renderDateGroup}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={editTransaction !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: "flex-end" }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Transaction</Text>
              <TouchableOpacity onPress={() => setEditTransaction(null)}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Amount</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editedAmount}
                onChangeText={(v) => {
                  setEditedAmount(v);
                  setEditedCashback(recalcCashback(v, editedMerchant, editedCategory));
                }}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Merchant</Text>
              {!useCustomMerchant ? (
                <Dropdown
                  placeholder="Select merchant…"
                  items={[
                    ...uniqueMerchants.map((m) => ({ label: m, value: m })),
                    { label: "+ New merchant…", value: "__custom__" },
                  ]}
                  selectedValue={editedMerchant}
                  onValueChange={(v) => {
                    if (v === "__custom__") { setUseCustomMerchant(true); setEditedMerchant(""); }
                    else { const s = v as string; setEditedMerchant(s); setEditedCashback(recalcCashback(editedAmount, s, editedCategory)); }
                  }}
                  searchable
                />
              ) : (
                <View style={styles.customRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={editedMerchant}
                    onChangeText={(v) => { setEditedMerchant(v); setEditedCashback(recalcCashback(editedAmount, v, editedCategory)); }}
                    placeholder="Type merchant name"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                  <TouchableOpacity onPress={() => setUseCustomMerchant(false)} style={styles.switchBtn}>
                    <Feather name="list" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={editedDescription}
                onChangeText={setEditedDescription}
                placeholder="Description"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.inputLabel}>Category</Text>
              {!useCustomCategory ? (
                <Dropdown
                  placeholder="Select category…"
                  items={[
                    ...uniqueCategories.map((c) => ({ label: c, value: c })),
                    { label: "+ New category…", value: "__custom__" },
                  ]}
                  selectedValue={editedCategory}
                  onValueChange={(v) => {
                    if (v === "__custom__") { setUseCustomCategory(true); setEditedCategory(""); }
                    else { const s = v as string; setEditedCategory(s); setEditedCashback(recalcCashback(editedAmount, editedMerchant, s)); }
                  }}
                  searchable
                />
              ) : (
                <View style={styles.customRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={editedCategory}
                    onChangeText={(v) => { setEditedCategory(v); setEditedCashback(recalcCashback(editedAmount, editedMerchant, v)); }}
                    placeholder="Type category"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                  <TouchableOpacity onPress={() => setUseCustomCategory(false)} style={styles.switchBtn}>
                    <Feather name="list" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.cashbackPreview}>
                <Feather name="trending-up" size={14} color={COLORS.success} />
                <Text style={styles.cashbackPreviewTxt}>
                  Cashback: {formatAmount(editedCashback, settings.currency)}
                </Text>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditTransaction(null)}>
                  <Text style={styles.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                  <Text style={styles.saveTxt}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
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
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  exportBtnTxt: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontFamily: "Inter_700Bold" },
  screenTitle: { ...TYPOGRAPHY.h2 },

  filtersCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.xs,
  },
  filterLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  pickerWrap: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  picker: { height: 44 },

  searchRow: {
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.xs,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    flex: 1,
    padding: 0,
  },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    borderLeftWidth: 4,
    ...SHADOWS.xs,
  },
  summaryItem: { flex: 1, paddingVertical: SPACING.sm, alignItems: "center" },
  summaryVal: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },
  summaryLbl: { ...TYPOGRAPHY.micro, marginTop: 2 },
  summaryDiv: { width: 1, backgroundColor: COLORS.border },

  listContent: { paddingHorizontal: SPACING.md, paddingBottom: 80 },
  dateGroup: { marginBottom: SPACING.sm },
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.xs,
  },
  dateLabel: { ...TYPOGRAPHY.captionBold, color: COLORS.textSecondary },
  dateTotalAmt: { ...TYPOGRAPHY.captionBold, color: COLORS.text },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  emptyTitle: { ...TYPOGRAPHY.h4, color: COLORS.textSecondary },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { ...TYPOGRAPHY.h3 },
  inputLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4, marginTop: SPACING.sm },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 4,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  switchBtn: {
    padding: 10,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  cashbackPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  cashbackPreviewTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.success },
  modalActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  cancelBtn: {
    flex: 1,
    backgroundColor: COLORS.borderLight,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
  saveBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },
});

export default ShowReportScreen;

