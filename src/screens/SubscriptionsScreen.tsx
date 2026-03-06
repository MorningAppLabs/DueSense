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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import moment from "moment";
import { Calendar } from "react-native-calendars";
import { useStore } from "../store/store";
import {
  Subscription,
  SubscriptionPaymentMethod,
  SubscriptionBillingCycle,
  Card,
  Category,
} from "../types/types";
import { formatAmount } from "../utils/billingUtils";
import { ICON_PICKER_OPTIONS } from "../constants/categoryIcons";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";

const SUBSCRIPTION_DEFAULT_CATEGORIES: Category[] = [
  { name: "Streaming", icon: "tv" },
  { name: "Gaming", icon: "zap" },
  { name: "Music", icon: "music" },
  { name: "Software", icon: "code" },
  { name: "Cloud", icon: "cloud" },
  { name: "Food", icon: "coffee" },
  { name: "Shopping", icon: "shopping-bag" },
  { name: "Entertainment", icon: "film" },
  { name: "Health", icon: "heart" },
  { name: "Education", icon: "book-open" },
  { name: "Bills", icon: "file-text" },
  { name: "Others", icon: "tag" },
];

type PayMethod = SubscriptionPaymentMethod;
type BillCycle = SubscriptionBillingCycle;

const METHOD_INFO: Record<PayMethod, { icon: keyof typeof Feather.glyphMap; label: string }> = {
  Card: { icon: "credit-card", label: "Card" },
  UPI: { icon: "smartphone", label: "UPI" },
  PayPal: { icon: "dollar-sign", label: "PayPal" },
  Other: { icon: "link", label: "Other" },
};

const CYCLE_LABELS: Record<BillCycle, string> = {
  Weekly: "Weekly",
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  Yearly: "Yearly",
};

/** Convert subscription amount to monthly equivalent */
export const toMonthly = (amount: number, cycle: BillCycle): number => {
  switch (cycle) {
    case "Weekly": return (amount * 52) / 12;
    case "Monthly": return amount;
    case "Quarterly": return amount / 3;
    case "Yearly": return amount / 12;
  }
};

const EMPTY_FORM: Partial<Subscription> = {
  name: "",
  amount: undefined,
  paymentMethod: "Card",
  cardId: undefined,
  customMethodName: "",
  billingCycle: "Monthly",
  nextBillingDate: moment().add(1, "month").format("YYYY-MM-DD"),
  category: "Others",
  notes: "",
  active: true,
};

const SubscriptionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const {
    subscriptions,
    cards,
    settings,
    categories,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    addCategory,
  } = useStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Subscription>>({ ...EMPTY_FORM });
  const [calVisible, setCalVisible] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [customCatName, setCustomCatName] = useState("");
  const [customCatIcon, setCustomCatIcon] = useState("tag");

  const currency = settings.currency;

  /* ── Category helpers ─────────────────────────────── */
  const allCategories = useMemo<Category[]>(() => {
    const storeNames = new Set(categories.map((c) => c.name.toLowerCase()));
    const builtIn = SUBSCRIPTION_DEFAULT_CATEGORIES.filter(
      (d) => !storeNames.has(d.name.toLowerCase())
    );
    const all = [...builtIn, ...categories];
    const rest = all.filter((c) => c.name !== "Others").sort((a, b) => a.name.localeCompare(b.name));
    const others = all.filter((c) => c.name === "Others");
    return [...rest, ...others];
  }, [categories]);

  /* ── Derived data ─────────────────────────────────── */
  const active = useMemo(
    () => subscriptions.filter((s) => s.active).sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate)),
    [subscriptions]
  );
  const inactive = useMemo(
    () => subscriptions.filter((s) => !s.active),
    [subscriptions]
  );

  const totalMonthly = useMemo(
    () => active.reduce((sum, s) => sum + toMonthly(s.amount, s.billingCycle), 0),
    [active]
  );

  const dueSoon = useMemo(
    () => active.filter((s) => {
      const days = moment(s.nextBillingDate, "YYYY-MM-DD").diff(moment(), "days");
      return days >= 0 && days <= 7;
    }),
    [active]
  );

  /* ── Helpers ──────────────────────────────────────── */
  const setF = (key: keyof Subscription) => (val: any) =>
    setForm((f) => ({ ...f, [key]: val }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, nextBillingDate: moment().add(1, "month").format("YYYY-MM-DD") });
    setAmountText("");
    setCustomCatName("");
    setCustomCatIcon("tag");
    setModalVisible(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    // If the category is not a known built-in or store category, treat it as custom-Others
    const knownNames = allCategories.map((c) => c.name.toLowerCase());
    const isKnown = knownNames.includes(sub.category.toLowerCase());
    if (!isKnown && sub.category !== "Others") {
      setForm({ ...sub, category: "Others" });
      setCustomCatName(sub.category);
      const storeMatch = categories.find((c) => c.name.toLowerCase() === sub.category.toLowerCase());
      setCustomCatIcon(storeMatch?.icon ?? "tag");
    } else {
      setForm({ ...sub });
      setCustomCatName("");
      setCustomCatIcon("tag");
    }
    setAmountText(sub.amount.toString());
    setModalVisible(true);
  };

  const handleSave = () => {
    const amount = parseFloat(amountText);
    if (!form.name?.trim()) return Alert.alert("Error", "Subscription name is required.");
    if (!amount || amount <= 0) return Alert.alert("Error", "Enter a valid amount.");
    if (!form.nextBillingDate) return Alert.alert("Error", "Select next billing date.");
    if (form.paymentMethod === "Card" && !form.cardId)
      return Alert.alert("Error", "Please select a card.");

    // Resolve final category
    const finalCategory =
      form.category === "Others" && customCatName.trim()
        ? customCatName.trim()
        : form.category ?? "Others";

    // Persist custom category to store if it's new
    if (form.category === "Others" && customCatName.trim()) {
      addCategory({ name: customCatName.trim(), icon: customCatIcon });
    }

    const sub: Subscription = {
      id: editingId ?? Crypto.randomUUID(),
      name: form.name.trim(),
      amount,
      paymentMethod: form.paymentMethod ?? "Card",
      cardId: form.paymentMethod === "Card" ? form.cardId : undefined,
      customMethodName: form.paymentMethod !== "Card" ? (form.customMethodName?.trim() || undefined) : undefined,
      billingCycle: form.billingCycle ?? "Monthly",
      nextBillingDate: form.nextBillingDate,
      category: finalCategory,
      notes: form.notes?.trim() || undefined,
      active: form.active ?? true,
    };

    if (editingId) updateSubscription(sub);
    else addSubscription(sub);
    setModalVisible(false);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert("Delete Subscription", `Remove "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteSubscription(id) },
    ]);
  };

  /* ── Sub row ──────────────────────────────────────── */
  const SubRow = ({ sub }: { sub: Subscription }) => {
    const daysTill = moment(sub.nextBillingDate, "YYYY-MM-DD").diff(moment(), "days");
    const overdue = daysTill < 0;
    const dueSoon7 = daysTill >= 0 && daysTill <= 7;
    const card = cards.find((c: Card) => c.id === sub.cardId);
    const cardIdx = cards.findIndex((c: Card) => c.id === sub.cardId);
    const accentColor =
      sub.paymentMethod === "Card"
        ? getCardColor(cardIdx, card?.color)
        : sub.paymentMethod === "UPI"
        ? COLORS.info
        : sub.paymentMethod === "PayPal"
        ? "#003087"
        : COLORS.warning;

    const methodLabel =
      sub.paymentMethod === "Card"
        ? (card?.name ?? "Card")
        : sub.customMethodName || sub.paymentMethod;

    const monthlyEquiv = toMonthly(sub.amount, sub.billingCycle);

    return (
      <TouchableOpacity style={styles.subRow} onPress={() => openEdit(sub)} activeOpacity={0.85}>
        <View style={[styles.subAccent, { backgroundColor: accentColor }]} />
        <View style={[styles.subIconWrap, { backgroundColor: accentColor + "22" }]}>
          <Feather name={METHOD_INFO[sub.paymentMethod].icon} size={18} color={accentColor} />
        </View>
        <View style={styles.subContent}>
          <View style={styles.subTopRow}>
            <Text style={styles.subName} numberOfLines={1}>{sub.name}</Text>
            <Text style={[styles.subAmount, { color: accentColor }]}>
              {formatAmount(sub.amount, currency)}
            </Text>
          </View>
          <View style={styles.subMetaRow}>
            <Text style={styles.subMeta}>{methodLabel}</Text>
            <Text style={styles.subMetaDot}>·</Text>
            <Text style={styles.subMeta}>{CYCLE_LABELS[sub.billingCycle]}</Text>
            {sub.billingCycle !== "Monthly" && (
              <>
                <Text style={styles.subMetaDot}>·</Text>
                <Text style={[styles.subMeta, { color: COLORS.textMuted }]}>
                  {formatAmount(Math.round(monthlyEquiv), currency)}/mo
                </Text>
              </>
            )}
          </View>
          <View style={styles.subBottomRow}>
            <View style={[
              styles.duePill,
              overdue
                ? styles.duePillOverdue
                : dueSoon7
                ? styles.duePillSoon
                : styles.duePillNormal,
            ]}>
              <Feather
                name="clock"
                size={10}
                color={overdue ? COLORS.danger : dueSoon7 ? COLORS.warning : COLORS.textMuted}
              />
              <Text style={[
                styles.duePillTxt,
                { color: overdue ? COLORS.danger : dueSoon7 ? COLORS.warning : COLORS.textMuted },
              ]}>
                {overdue
                  ? `${Math.abs(daysTill)}d overdue`
                  : daysTill === 0
                  ? "Due today"
                  : `Due in ${daysTill}d`}
              </Text>
            </View>
            <Text style={styles.subCategory}>{sub.category}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(sub.id, sub.name)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="trash-2" size={15} color={COLORS.danger} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  /* ── Chip component ───────────────────────────────── */
  const Chip = ({ label, active: isActive, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
      style={[styles.chip, isActive && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipTxt, isActive && styles.chipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );

  /* ── Render ───────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Subscriptions</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Feather name="plus" size={20} color={COLORS.textInverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.danger }]}>
              {formatAmount(Math.round(totalMonthly), currency)}
            </Text>
            <Text style={styles.summaryLbl}>Per Month</Text>
          </View>
          <View style={styles.summaryDiv} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryVal}>{active.length}</Text>
            <Text style={styles.summaryLbl}>Active</Text>
          </View>
          <View style={styles.summaryDiv} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: dueSoon.length > 0 ? COLORS.warning : COLORS.textSecondary }]}>
              {dueSoon.length}
            </Text>
            <Text style={styles.summaryLbl}>Due This Week</Text>
          </View>
          <View style={styles.summaryDiv} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: COLORS.success }]}>
              {formatAmount(Math.round(totalMonthly * 12), currency)}
            </Text>
            <Text style={styles.summaryLbl}>Per Year</Text>
          </View>
        </View>

        {/* Active subscriptions */}
        {active.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="repeat" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No subscriptions yet</Text>
            <Text style={styles.emptyBody}>Track Netflix, Spotify, cloud storage and more.</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd}>
              <Text style={styles.emptyAddTxt}>Add Subscription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Active ({active.length})</Text>
            {active.map((s) => <SubRow key={s.id} sub={s} />)}
          </>
        )}

        {/* Inactive */}
        {inactive.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>Paused ({inactive.length})</Text>
            {inactive.map((s) => (
              <View key={s.id} style={styles.inactiveRow}>
                <SubRow sub={s} />
              </View>
            ))}
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit Subscription" : "New Subscription"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <Text style={styles.fieldLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={setF("name")}
                placeholder="e.g. Netflix, Spotify"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Amount */}
              <Text style={styles.fieldLabel}>Amount *</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                keyboardType="numeric"
                value={amountText}
                onChangeText={setAmountText}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Payment method */}
              <Text style={styles.fieldLabel}>Payment Method</Text>
              <View style={styles.chipRow}>
                {(["Card", "UPI", "PayPal", "Other"] as PayMethod[]).map((m) => (
                  <Chip
                    key={m}
                    label={m}
                    active={form.paymentMethod === m}
                    onPress={() => setF("paymentMethod")(m)}
                  />
                ))}
              </View>

              {/* Card selector */}
              {form.paymentMethod === "Card" && (
                <>
                  <Text style={styles.fieldLabel}>Select Card</Text>
                  {cards.length === 0 ? (
                    <Text style={styles.noCardTxt}>No cards added yet.</Text>
                  ) : (
                    cards.map((c: Card, idx: number) => {
                      const color = getCardColor(idx, c.color);
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.cardPickerItem, form.cardId === c.id && { borderColor: color, borderWidth: 2 }]}
                          onPress={() => setF("cardId")(c.id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.cardDot, { backgroundColor: color }]} />
                          <Text style={styles.cardPickerName}>{c.name}</Text>
                          {form.cardId === c.id && (
                            <Feather name="check-circle" size={16} color={color} />
                          )}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </>
              )}

              {/* Custom method name for UPI/PayPal/Other */}
              {form.paymentMethod !== "Card" && (
                <>
                  <Text style={styles.fieldLabel}>
                    {form.paymentMethod === "UPI" ? "UPI App (optional)" :
                     form.paymentMethod === "PayPal" ? "PayPal Account (optional)" :
                     "Method Name (optional)"}
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={form.customMethodName}
                    onChangeText={setF("customMethodName")}
                    placeholder={
                      form.paymentMethod === "UPI" ? "e.g. Google Pay, PhonePe" :
                      form.paymentMethod === "PayPal" ? "e.g. your@email.com" :
                      "e.g. Bank Transfer"
                    }
                    placeholderTextColor={COLORS.textMuted}
                  />
                </>
              )}

              {/* Billing cycle */}
              <Text style={styles.fieldLabel}>Billing Cycle</Text>
              <View style={styles.chipRow}>
                {(["Weekly", "Monthly", "Quarterly", "Yearly"] as BillCycle[]).map((c) => (
                  <Chip
                    key={c}
                    label={c}
                    active={form.billingCycle === c}
                    onPress={() => setF("billingCycle")(c)}
                  />
                ))}
              </View>

              {/* Next billing date */}
              <Text style={styles.fieldLabel}>Next Billing Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setCalVisible(true)}>
                <Feather name="calendar" size={16} color={COLORS.primary} />
                <Text style={styles.dateTxt}>
                  {form.nextBillingDate
                    ? moment(form.nextBillingDate, "YYYY-MM-DD").format("DD MMM YYYY")
                    : "Select date"}
                </Text>
              </TouchableOpacity>

              {/* Category */}
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.catGrid}>
                {allCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.name}
                    style={[styles.catItem, form.category === cat.name && styles.catItemActive]}
                    onPress={() => {
                      setF("category")(cat.name);
                      if (cat.name !== "Others") {
                        setCustomCatName("");
                        setCustomCatIcon("tag");
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name={cat.icon as any}
                      size={14}
                      color={form.category === cat.name ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.catTxt, form.category === cat.name && { color: COLORS.primary }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom category name + icon picker for Others */}
              {form.category === "Others" && (
                <>
                  <Text style={styles.fieldLabel}>Custom Category Name</Text>
                  <TextInput
                    style={styles.input}
                    value={customCatName}
                    onChangeText={setCustomCatName}
                    placeholder="e.g. Fitness, News…"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="words"
                  />
                  <Text style={styles.fieldLabel}>Choose an Icon</Text>
                  <View style={styles.catGrid}>
                    {ICON_PICKER_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.icon}
                        style={[styles.catItem, customCatIcon === opt.icon && styles.catItemActive]}
                        onPress={() => setCustomCatIcon(opt.icon as string)}
                        activeOpacity={0.8}
                      >
                        <Feather
                          name={opt.icon as any}
                          size={14}
                          color={customCatIcon === opt.icon ? COLORS.primary : COLORS.textSecondary}
                        />
                        <Text
                          style={[styles.catTxt, customCatIcon === opt.icon && { color: COLORS.primary }, { fontSize: 9 }]}
                          numberOfLines={1}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, { height: 64 }]}
                multiline
                value={form.notes}
                onChangeText={setF("notes")}
                placeholder="Any notes…"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Active toggle */}
              <View style={styles.activeRow}>
                <View>
                  <Text style={styles.activeLabel}>Active</Text>
                  <Text style={styles.activeSub}>Turn off to pause tracking</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleBtn, (form.active ?? true) && styles.toggleBtnOn]}
                  onPress={() => setF("active")(!(form.active ?? true))}
                >
                  <Text style={[styles.toggleTxt, (form.active ?? true) && styles.toggleTxtOn]}>
                    {(form.active ?? true) ? "On" : "Off"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Save button */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Feather name="check" size={18} color={COLORS.textInverse} />
                <Text style={styles.saveBtnTxt}>{editingId ? "Update" : "Add Subscription"}</Text>
              </TouchableOpacity>
              <View style={{ height: SPACING.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Calendar modal */}
      <Modal visible={calVisible} animationType="slide" transparent onRequestClose={() => setCalVisible(false)}>
        <View style={styles.calOverlay}>
          <View style={styles.calBox}>
            <View style={styles.calHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setCalVisible(false)}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Calendar
              current={form.nextBillingDate ?? moment().add(1, "month").format("YYYY-MM-DD")}
              onDayPress={(d: any) => {
                setF("nextBillingDate")(d.dateString);
                setCalVisible(false);
              }}
              markedDates={
                form.nextBillingDate
                  ? { [form.nextBillingDate]: { selected: true, selectedColor: COLORS.primary } }
                  : {}
              }
              theme={{
                backgroundColor: COLORS.surface,
                calendarBackground: COLORS.surface,
                selectedDayBackgroundColor: COLORS.primary,
                todayTextColor: COLORS.primary,
                arrowColor: COLORS.primary,
                textDayFontFamily: "Inter_400Regular",
                textMonthFontFamily: "Inter_700Bold",
                textDayHeaderFontFamily: "Inter_600SemiBold",
              }}
            />
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
  screenTitle: { ...TYPOGRAPHY.h3, flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.sm,
  },

  container: { padding: SPACING.md, paddingBottom: SPACING.xxl },

  // Summary card
  summaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.md,
    ...SHADOWS.md,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryVal: { ...TYPOGRAPHY.bodyBold, fontSize: 15 },
  summaryLbl: { ...TYPOGRAPHY.micro, marginTop: 2, textAlign: "center" },
  summaryDiv: { width: 1, height: 32, backgroundColor: COLORS.border, marginHorizontal: 2 },

  // Empty
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    ...SHADOWS.xs,
    gap: SPACING.sm,
  },
  emptyTitle: { ...TYPOGRAPHY.h4, color: COLORS.textSecondary },
  emptyBody: { ...TYPOGRAPHY.caption, textAlign: "center" },
  emptyAddBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  emptyAddTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },

  sectionTitle: {
    ...TYPOGRAPHY.h4,
    marginBottom: SPACING.sm,
    color: COLORS.text,
  },

  // Subscription row
  subRow: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  subAccent: { width: 4, alignSelf: "stretch" },
  subIconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.sm,
    flexShrink: 0,
  },
  subContent: { flex: 1, paddingVertical: SPACING.sm, paddingLeft: SPACING.sm },
  subTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  subName: { ...TYPOGRAPHY.bodySemiBold, flex: 1, marginRight: SPACING.xs },
  subAmount: { ...TYPOGRAPHY.bodyBold, fontSize: 15 },
  subMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  subMeta: { ...TYPOGRAPHY.micro, color: COLORS.textSecondary },
  subMetaDot: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
  subBottomRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  duePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  duePillNormal: { backgroundColor: COLORS.borderLight },
  duePillSoon: { backgroundColor: COLORS.warningLight },
  duePillOverdue: { backgroundColor: COLORS.dangerLight },
  duePillTxt: { fontFamily: "Inter_700Bold", fontSize: 10 },
  subCategory: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginLeft: "auto" as any },
  deleteBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  inactiveRow: { opacity: 0.55 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { ...TYPOGRAPHY.h3 },

  fieldLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: SPACING.xs,
  },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  amountInput: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center", paddingVertical: 12 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginBottom: SPACING.xs },
  chip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { ...TYPOGRAPHY.caption },
  chipTxtActive: { color: COLORS.textInverse },

  noCardTxt: { ...TYPOGRAPHY.caption, color: COLORS.textMuted, marginBottom: SPACING.sm },
  cardPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  cardDot: { width: 10, height: 10, borderRadius: 5 },
  cardPickerName: { ...TYPOGRAPHY.bodySemiBold, flex: 1 },

  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  dateTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },

  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginBottom: SPACING.xs },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catItemActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catTxt: { ...TYPOGRAPHY.caption },

  activeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeLabel: { ...TYPOGRAPHY.bodyBold },
  activeSub: { ...TYPOGRAPHY.micro, marginTop: 2 },
  toggleBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtnOn: { backgroundColor: COLORS.successLight, borderColor: COLORS.success },
  toggleTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
  toggleTxtOn: { color: COLORS.success },

  saveBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    ...SHADOWS.sm,
  },
  saveBtnTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },

  calOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  calBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
  },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
});

export default SubscriptionsScreen;
