import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Modal,
  Alert,
  StatusBar,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import moment from "moment";
import * as Crypto from "expo-crypto";
import { Calendar } from "react-native-calendars";
import { useStore } from "../store/store";
import { Card, Transaction } from "../types/types";
import { calculateTransactionCashback, formatAmount } from "../utils/billingUtils";
import { getCategoryIconFull, DEFAULT_CATEGORIES, ICON_PICKER_OPTIONS } from "../constants/categoryIcons";
import type { Category } from "../types/types";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";

type RootStackParamList = { AddSpending: undefined };
type NavProp = NativeStackNavigationProp<RootStackParamList>;

type Step = 1 | 2 | 3;

interface FormState {
  cardId: string;
  amount: string;
  date: string;
  paymentType: "Full Payment" | "EMI";
  emiMonths: string;
  emiInterest: string;
  onlineOffline: "Online" | "Offline";
  merchant: string;
  description: string;
  category: string;
  otherCategoryName: string;
  forWhom: "Myself" | "Someone Else";
  personName: string;
  repaid: boolean;
}

const EMPTY_FORM: FormState = {
  cardId: "",
  amount: "",
  date: moment().format("YYYY-MM-DD"),
  paymentType: "Full Payment",
  emiMonths: "6",
  emiInterest: "0",
  onlineOffline: "Online",
  merchant: "",
  description: "",
  category: "Others",
  otherCategoryName: "",
  forWhom: "Myself",
  personName: "",
  repaid: false,
};

const AddSpendingScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { cards, merchants, categories, persons, settings, transactions, addTransaction, addMerchant, addCategory, addPerson } = useStore();

  // Merge + sort alphabetically; "Others" always last
  const allCategories = useMemo<Category[]>(() => {
    const customNames = new Set(categories.map((c: Category) => c.name.toLowerCase()));
    const builtIn = DEFAULT_CATEGORIES.filter((d) => !customNames.has(d.name.toLowerCase()));
    const all = [...builtIn, ...categories];
    const rest = all.filter((c) => c.name !== "Others").sort((a, b) => a.name.localeCompare(b.name));
    const others = all.filter((c) => c.name === "Others");
    return [...rest, ...others];
  }, [categories]);

  // Icon picker state for new custom categories
  const [customCategoryIcon, setCustomCategoryIcon] = useState("tag");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });

  // Calendar modal
  const [calVisible, setCalVisible] = useState(false);

  // Merchant autocomplete
  const [merchantSearch, setMerchantSearch] = useState("");
  const [showMerchantSugg, setShowMerchantSugg] = useState(false);

  // Person autocomplete
  const [personSearch, setPersonSearch] = useState("");
  const [showPersonSugg, setShowPersonSugg] = useState(false);

  const selectedCard = cards.find((c: Card) => c.id === form.cardId) ?? null;
  const cardIdx = cards.findIndex((c: Card) => c.id === form.cardId);
  const cardColor = getCardColor(cardIdx, selectedCard?.color);

  const estimatedCashback = useMemo(() => {
    if (!selectedCard || !form.amount || !form.date) return 0;
    return calculateTransactionCashback(
      selectedCard,
      transactions,
      Number(form.amount) || 0,
      form.paymentType,
      form.onlineOffline,
      form.merchant.trim(),
      form.category,
      form.date
    );
  }, [selectedCard, form.amount, form.date, form.paymentType, form.onlineOffline, form.merchant, form.category]);

  const merchantSugg = useMemo(() => {
    const query = merchantSearch.toLowerCase();
    if (!query) return [];
    // Only merchant names (user-saved + from cashback rules), NOT category names
    const rulesMerchants = cards.flatMap((c: Card) =>
      c.cashbackRules?.map((r: any) => r.merchant).filter(Boolean) ?? []
    );
    const all = [...new Set([...merchants, ...rulesMerchants])] as string[];
    return all.filter((m) => m.toLowerCase().includes(query)).slice(0, 6);
  }, [merchantSearch, merchants, cards]);

  const personSugg = useMemo(() => {
    const query = personSearch.toLowerCase();
    if (!query) return [];
    return persons.filter((p: string) => p.toLowerCase().includes(query)).slice(0, 5);
  }, [personSearch, persons]);

  const setF = (key: keyof FormState) => (val: any) => setForm((f) => ({ ...f, [key]: val }));

  const stepNext = () => {
    if (step === 1) {
      if (!form.cardId) return Alert.alert("Error", "Please select a card.");
      if (!Number(form.amount) || Number(form.amount) <= 0)
        return Alert.alert("Error", "Enter a valid amount.");
      setStep(2);
    } else if (step === 2) {
      if (!form.merchant.trim()) return Alert.alert("Error", "Merchant name is required.");
      setStep(3);
    }
  };

  const handleSubmit = () => {
    const amount = Number(form.amount);
    const tx: Transaction = {
      id: Crypto.randomUUID(),
      cardId: form.cardId,
      amount,
      paymentType: form.paymentType,
      emiPlan:
        form.paymentType === "EMI"
          ? { amount, months: Number(form.emiMonths) || 6, interest: Number(form.emiInterest) || 0 }
          : undefined,
      date: form.date,
      onlineOffline: form.onlineOffline,
      merchant: form.merchant.trim(),
      description: form.description.trim(),
      category: form.category === "Others" && form.otherCategoryName.trim()
        ? form.otherCategoryName.trim()
        : form.category,
      cashback: estimatedCashback,
      forWhom: form.forWhom,
      personName: form.forWhom === "Someone Else" ? form.personName.trim() : undefined,
      repaid: form.forWhom === "Myself" ? false : form.repaid,
    };
    addTransaction(tx);
    if (form.merchant.trim() && !merchants.includes(form.merchant.trim())) {
      addMerchant(form.merchant.trim());
    }
    // Save custom category to store as Category (name + icon)
    const customName = form.category === "Others" && form.otherCategoryName.trim()
      ? form.otherCategoryName.trim()
      : null;
    if (customName) {
      const alreadyExists = categories.some(
        (c: Category) => c.name.toLowerCase() === customName.toLowerCase()
      );
      if (!alreadyExists) {
        addCategory({ name: customName, icon: customCategoryIcon });
      }
    }
    if (form.forWhom === "Someone Else" && form.personName.trim() && !persons.includes(form.personName.trim())) {
      addPerson(form.personName.trim());
    }
    navigation.goBack();
  };

  const ChipRow = ({
    options,
    value,
    onSelect,
  }: {
    options: string[];
    value: string;
    onSelect: (v: string) => void;
  }) => (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.8}
        >
          <Text style={[styles.chipTxt, value === opt && styles.chipTxtActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const StepDot = ({ n }: { n: Step }) => (
    <View style={[styles.stepDot, step === n && styles.stepDotActive, step > n && styles.stepDotDone]}>
      {step > n ? (
        <Feather name="check" size={12} color={COLORS.textInverse} />
      ) : (
        <Text style={[styles.stepDotTxt, (step === n || step > n) && { color: COLORS.textInverse }]}>{n}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => (step === 1 ? navigation.goBack() : setStep((s) => (s - 1) as Step))} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Add Spending</Text>
        {/* Step indicators */}
        <View style={styles.steps}>
          <StepDot n={1} />
          <View style={styles.stepLine} />
          <StepDot n={2} />
          <View style={styles.stepLine} />
          <StepDot n={3} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── STEP 1: Card, Amount, Date, Type ── */}
        {step === 1 && (
          <>
            <Text style={styles.stepHint}>Select Card &amp; Amount</Text>

            {/* Card picker */}
            <View style={styles.cardPicker}>
              {cards.length === 0 ? (
                <Text style={styles.noCardTxt}>No cards added yet. Go to "Cards" tab first.</Text>
              ) : (
                cards.map((card: Card, idx: number) => {
                  const c = getCardColor(idx, card.color);
                  return (
                    <TouchableOpacity
                      key={card.id}
                      style={[styles.cardPickerItem, form.cardId === card.id && { borderColor: c, borderWidth: 2 }]}
                      onPress={() => setF("cardId")(card.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.cardPickerDot, { backgroundColor: c }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardPickerName}>{card.name}</Text>
                        {card.lastFourDigits ? (
                          <Text style={styles.cardPickerSub}>•••• {card.lastFourDigits}</Text>
                        ) : null}
                      </View>
                      {form.cardId === card.id && (
                        <Feather name="check-circle" size={18} color={c} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            <Text style={styles.fieldLabel}>Amount *</Text>
            <View style={styles.amountRow}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeTxt}>{settings.currency}</Text>
              </View>
              <TextInput
                style={[styles.input, styles.amountInput, { flex: 1 }]}
                keyboardType="numeric"
                value={form.amount}
                onChangeText={setF("amount")}
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <Text style={styles.fieldLabel}>Date *</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setCalVisible(true)}>
              <Feather name="calendar" size={16} color={COLORS.primary} />
              <Text style={styles.dateTxt}>{moment(form.date, "YYYY-MM-DD").format("DD MMM YYYY")}</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Payment Type</Text>
            <ChipRow
              options={["Full Payment", "EMI"]}
              value={form.paymentType}
              onSelect={(v) => setF("paymentType")(v)}
            />

            {form.paymentType === "EMI" && (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>EMI Months</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.emiMonths}
                    onChangeText={setF("emiMonths")}
                    placeholder="6"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
                <View style={{ width: SPACING.sm }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Interest %</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={form.emiInterest}
                    onChangeText={setF("emiInterest")}
                    placeholder="0"
                    placeholderTextColor={COLORS.textMuted}
                  />
                </View>
              </View>
            )}

            <Text style={styles.fieldLabel}>Mode</Text>
            <ChipRow
              options={["Online", "Offline"]}
              value={form.onlineOffline}
              onSelect={(v) => setF("onlineOffline")(v)}
            />
          </>
        )}

        {/* ── STEP 2: Merchant, Description, Category ── */}
        {step === 2 && (
          <>
            <Text style={styles.stepHint}>Transaction Details</Text>

            <Text style={styles.fieldLabel}>Merchant *</Text>
            <View style={{ position: "relative" }}>
              <TextInput
                style={styles.input}
                value={form.merchant}
                onChangeText={(v) => {
                  setF("merchant")(v);
                  setMerchantSearch(v);
                  setShowMerchantSugg(true);
                }}
                onBlur={() => setTimeout(() => setShowMerchantSugg(false), 150)}
                placeholder="e.g. Amazon, Swiggy"
                placeholderTextColor={COLORS.textMuted}
              />
              {showMerchantSugg && merchantSugg.length > 0 && (
                <View style={styles.suggBox}>
                  {merchantSugg.map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={styles.suggItem}
                      onPress={() => {
                        setF("merchant")(m);
                        setShowMerchantSugg(false);
                      }}
                    >
                      <Text style={styles.suggTxt}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 72 }]}
              multiline
              value={form.description}
              onChangeText={setF("description")}
              placeholder="Optional notes…"
              placeholderTextColor={COLORS.textMuted}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {allCategories.map((cat: Category) => (
                <TouchableOpacity
                  key={cat.name}
                  style={[styles.catItem, form.category === cat.name && styles.catItemActive]}
                  onPress={() => {
                    setF("category")(cat.name);
                    // Reset custom fields when switching away from Others
                    if (cat.name !== "Others") {
                      setF("otherCategoryName")("");
                      setCustomCategoryIcon("tag");
                      setIconPickerOpen(false);
                    }
                  }}
                >
                  <Feather
                    name={getCategoryIconFull(cat.name, categories) as any}
                    size={16}
                    color={form.category === cat.name ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text style={[styles.catTxt, form.category === cat.name && { color: COLORS.primary }]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.category === "Others" && (
              <>
                <Text style={styles.fieldLabel}>Custom Category Name</Text>
                <TextInput
                  style={styles.input}
                  value={form.otherCategoryName}
                  onChangeText={setF("otherCategoryName")}
                  placeholder="e.g. Subscription, Investment…"
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="words"
                />

                {/* Icon picker for the custom category */}
                <Text style={styles.fieldLabel}>Choose an Icon for this Category</Text>
                <View style={[styles.categoryGrid, { marginBottom: 4 }]}>
                  {ICON_PICKER_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.icon}
                      style={[
                        styles.catItem,
                        customCategoryIcon === opt.icon && styles.catItemActive,
                      ]}
                      onPress={() => setCustomCategoryIcon(opt.icon as string)}
                    >
                      <Feather
                        name={opt.icon}
                        size={16}
                        color={customCategoryIcon === opt.icon ? COLORS.primary : COLORS.textSecondary}
                      />
                      <Text
                        style={[
                          styles.catTxt,
                          customCategoryIcon === opt.icon && { color: COLORS.primary },
                          { fontSize: 9 },
                        ]}
                        numberOfLines={1}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Cashback preview */}
            {estimatedCashback > 0 && (
              <View style={styles.cashbackPreview}>
                <Feather name="star" size={14} color={COLORS.success} />
                <Text style={styles.cashbackTxt}>
                  Est. cashback: {formatAmount(estimatedCashback, settings.currency)}
                </Text>
              </View>
            )}
          </>
        )}

        {/* ── STEP 3: For Whom ── */}
        {step === 3 && (
          <>
            <Text style={styles.stepHint}>Who paid?</Text>

            <Text style={styles.fieldLabel}>Paid for</Text>
            <ChipRow
              options={["Myself", "Someone Else"]}
              value={form.forWhom}
              onSelect={(v) => setF("forWhom")(v)}
            />

            {form.forWhom === "Someone Else" && (
              <>
                <Text style={styles.fieldLabel}>Person's Name *</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={styles.input}
                    value={form.personName}
                    onChangeText={(v) => {
                      setF("personName")(v);
                      setPersonSearch(v);
                      setShowPersonSugg(true);
                    }}
                    onBlur={() => setTimeout(() => setShowPersonSugg(false), 150)}
                    placeholder="e.g. Sherlock Holmes"
                    placeholderTextColor={COLORS.textMuted}
                  />
                  {showPersonSugg && personSugg.length > 0 && (
                    <View style={styles.suggBox}>
                      {personSugg.map((p: string) => (
                        <TouchableOpacity
                          key={p}
                          style={styles.suggItem}
                          onPress={() => {
                            setF("personName")(p);
                            setShowPersonSugg(false);
                          }}
                        >
                          <Text style={styles.suggTxt}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.bodyBold}>Already Repaid?</Text>
                    <Text style={styles.caption}>Mark if person has already paid you back.</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggleBtn, form.repaid && styles.toggleBtnActive]}
                    onPress={() => setF("repaid")(!form.repaid)}
                  >
                    <Text style={[styles.toggleTxt, form.repaid && styles.toggleTxtActive]}>
                      {form.repaid ? "Yes" : "No"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Summary */}
            <View style={[styles.summaryBox, { borderLeftColor: cardColor }]}>
              <Text style={styles.summaryTitle}>Transaction Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Card</Text>
                <Text style={styles.summaryVal}>{selectedCard?.name ?? "—"}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={[styles.summaryVal, { color: COLORS.danger, fontWeight: "700" }]}>
                  {formatAmount(Number(form.amount) || 0, settings.currency)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Merchant</Text>
                <Text style={styles.summaryVal}>{form.merchant || "—"}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date</Text>
                <Text style={styles.summaryVal}>{moment(form.date, "YYYY-MM-DD").format("DD MMM YYYY")}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Category</Text>
                <Text style={styles.summaryVal}>
                  {form.category === "Others" && form.otherCategoryName.trim()
                    ? form.otherCategoryName.trim()
                    : form.category}
                </Text>
              </View>
              {estimatedCashback > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cashback</Text>
                  <Text style={[styles.summaryVal, { color: COLORS.success }]}>
                    {formatAmount(estimatedCashback, settings.currency)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Bottom actions */}
        <View style={styles.bottomRow}>
          {step < 3 ? (
            <TouchableOpacity style={styles.nextBtn} onPress={stepNext}>
              <Text style={styles.nextBtnTxt}>Next</Text>
              <Feather name="chevron-right" size={18} color={COLORS.textInverse} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.nextBtn, { backgroundColor: COLORS.success }]} onPress={handleSubmit}>
              <Feather name="check" size={18} color={COLORS.textInverse} />
              <Text style={styles.nextBtnTxt}>Save Transaction</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Calendar Modal */}
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
              current={form.date}
              maxDate={moment().format("YYYY-MM-DD")}
              onDayPress={(d: any) => {
                setF("date")(d.dateString);
                setCalVisible(false);
              }}
              markedDates={{ [form.date]: { selected: true, selectedColor: COLORS.primary } }}
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
  steps: { flexDirection: "row", alignItems: "center" },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepDotTxt: { ...TYPOGRAPHY.micro, fontWeight: "700", color: COLORS.textSecondary },
  stepLine: { width: 16, height: 1.5, backgroundColor: COLORS.border, marginHorizontal: 2 },

  container: { padding: SPACING.md },
  stepHint: { ...TYPOGRAPHY.h4, marginBottom: SPACING.md },
  fieldLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },
  input: {
    ...TYPOGRAPHY.body,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  amountInput: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center", paddingVertical: 14 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  currencyBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 44,
  },
  currencyBadgeTxt: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: COLORS.primary,
  },
  row: { flexDirection: "row" },

  cardPicker: { marginBottom: SPACING.sm },
  cardPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    ...SHADOWS.xs,
  },
  cardPickerDot: { width: 12, height: 12, borderRadius: 6 },
  cardPickerName: { ...TYPOGRAPHY.bodyBold },
  cardPickerSub: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
  noCardTxt: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: "center", padding: SPACING.md },

  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dateTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.primary },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginBottom: SPACING.sm },
  chip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { ...TYPOGRAPHY.caption },
  chipTxtActive: { color: COLORS.textInverse },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catItemActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catTxt: { ...TYPOGRAPHY.caption },

  cashbackPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successLight ?? "#F0FDF4",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  cashbackTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.success },

  suggBox: {
    position: "absolute",
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 100,
    ...SHADOWS.md,
  },
  suggItem: { padding: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  suggTxt: { ...TYPOGRAPHY.body },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.xs,
  },
  bodyBold: { ...TYPOGRAPHY.bodyBold },
  caption: { ...TYPOGRAPHY.caption, marginTop: 2 },
  toggleBtn: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.borderLight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtnActive: { backgroundColor: COLORS.successLight ?? "#F0FDF4", borderColor: COLORS.success },
  toggleTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
  toggleTxtActive: { color: COLORS.success },

  summaryBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 4,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  summaryTitle: { ...TYPOGRAPHY.h4, marginBottom: SPACING.sm },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  summaryLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary },
  summaryVal: { ...TYPOGRAPHY.body },

  bottomRow: { marginTop: SPACING.md },
  nextBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    ...SHADOWS.sm,
  },
  nextBtnTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },

  // Calendar modal
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
  modalTitle: { ...TYPOGRAPHY.h3 },
});

export default AddSpendingScreen;

