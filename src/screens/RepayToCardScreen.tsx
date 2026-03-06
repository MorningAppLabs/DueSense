import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Animated,
  Modal,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Dropdown from "../components/Dropdown";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useStore } from "../store/store";
import moment from "moment";
import * as Crypto from "expo-crypto";
import { Card, Repayment, Transaction } from "../types/types";
import {
  getBillingCycleDates,
  getBillingCycleOptions,
  resolveCycleRange,
  getUnbilledAmount,
  formatAmount,
} from "../utils/billingUtils";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";

type RootStackParamList = { RepayToCard: undefined };
type NavProp = NativeStackNavigationProp<RootStackParamList>;

const RepayToCardScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { cards, repayments, settings, addRepayment, updateRepayment, deleteRepayment, transactions } = useStore();
  const [cardId, setCardId] = useState("");
  const [billingCycle, setBillingCycle] = useState("current");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [editModal, setEditModal] = useState<Repayment | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.96, friction: 8, tension: 40, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();

  const selectedCard = cards.find((c: Card) => c.id === cardId) ?? null;
  const cardIdx = cards.findIndex((c: Card) => c.id === cardId);
  const cardColor = getCardColor(cardIdx, selectedCard?.color);

  const billingCycleOptions = selectedCard
    ? getBillingCycleOptions(selectedCard, transactions)
    : [];

  const { start: cycleStart } = selectedCard
    ? resolveCycleRange(selectedCard, billingCycle)
    : { start: moment() };

  const unbilled = selectedCard
    ? getUnbilledAmount(selectedCard, transactions, repayments)
    : 0;

  const cycleRepayments = repayments.filter(
    (r: Repayment) =>
      r.cardId === cardId &&
      r.billingCycleStart &&
      moment(r.billingCycleStart, "YYYY-MM-DD").isSame(cycleStart, "day")
  );

  const totalRepaid = cycleRepayments.reduce((s: number, r: Repayment) => s + r.amount, 0);

  const handleAdd = () => {
    if (!cardId) return Alert.alert("Error", "Please select a card.");
    const val = Number(amount);
    if (!val || val <= 0) return Alert.alert("Error", "Enter a valid amount.");
    const repayment: Repayment = {
      id: Crypto.randomUUID(),
      cardId,
      amount: val,
      date: moment().format("YYYY-MM-DD"),
      description: description.trim() || undefined,
      billingCycleStart: cycleStart.format("YYYY-MM-DD"),
    };
    addRepayment(repayment);
    setAmount("");
    setDescription("");
    Alert.alert("Success", "Repayment recorded!");
  };

  const handleSaveEdit = () => {
    if (!editModal) return;
    const val = Number(editAmount);
    if (!val || val <= 0) return Alert.alert("Error", "Enter a valid amount.");
    updateRepayment({ ...editModal, amount: val, description: editDescription.trim() || undefined });
    setEditModal(null);
  };

  const renderRepayment = ({ item }: { item: Repayment }) => (
    <View style={styles.repaymentItem}>
      <View style={[styles.repaymentIcon, { backgroundColor: cardColor + "20" }]}>
        <Feather name="check-circle" size={18} color={cardColor} />
      </View>
      <View style={styles.repaymentContent}>
        <Text style={styles.repaymentAmount}>{formatAmount(item.amount, settings.currency)}</Text>
        <Text style={styles.repaymentDate}>{moment(item.date, "YYYY-MM-DD").format("DD MMM YYYY")}</Text>
        {item.description ? <Text style={styles.repaymentDesc}>{item.description}</Text> : null}
      </View>
      <View style={styles.repaymentActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => {
            setEditModal(item);
            setEditAmount(item.amount.toString());
            setEditDescription(item.description ?? "");
          }}
        >
          <Feather name="edit-2" size={15} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.dangerLight }]}
          onPress={() => setDeleteId(item.id)}
        >
          <Feather name="trash-2" size={15} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Repay to Card</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Card & cycle selectors */}
        <View style={styles.selectorCard}>
          <Text style={styles.fieldLabel}>Credit Card</Text>
          <Dropdown
            items={cards.map((c: Card) => ({ label: c.name, value: c.id }))}
            selectedValue={cardId}
            onValueChange={(v) => { setCardId(v); setBillingCycle("current"); }}
            placeholder="Select card…"
            label="Select Card"
          />

          {selectedCard && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: SPACING.sm }]}>Billing Cycle</Text>
              <Dropdown
                items={billingCycleOptions.map((o) => ({ label: o.label, value: o.value }))}
                selectedValue={billingCycle}
                onValueChange={setBillingCycle}
                placeholder="Select cycle…"
                label="Select Billing Cycle"
              />
            </>
          )}
        </View>

        {/* Balance summary */}
        {selectedCard && (
          <View style={[styles.balanceCard, { borderLeftColor: cardColor }]}>
            <View style={styles.balanceItem}>
              <Text style={[styles.balanceVal, { color: COLORS.danger }]}>
                {formatAmount(unbilled, settings.currency)}
              </Text>
              <Text style={styles.balanceLbl}>Unbilled Amount</Text>
            </View>
            <View style={styles.balanceDiv} />
            <View style={styles.balanceItem}>
              <Text style={[styles.balanceVal, { color: COLORS.success }]}>
                {formatAmount(totalRepaid, settings.currency)}
              </Text>
              <Text style={styles.balanceLbl}>Repaid This Cycle</Text>
            </View>
            <View style={styles.balanceDiv} />
            <View style={styles.balanceItem}>
              <Text style={[styles.balanceVal, { color: COLORS.primary }]}>
                {formatAmount(Math.max(0, unbilled - totalRepaid), settings.currency)}
              </Text>
              <Text style={styles.balanceLbl}>Remaining Due</Text>
            </View>
          </View>
        )}

        {/* Add repayment form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Record Repayment</Text>

          <Text style={styles.fieldLabel}>Amount</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            placeholder={"Amount in " + settings.currency}
            placeholderTextColor={COLORS.textMuted}
          />
          {selectedCard && amount !== "" && Number(amount) > 0 && (
            <View style={styles.afterRepayRow}>
              <Feather name="check-circle" size={14} color={COLORS.success} />
              <Text style={styles.afterRepayTxt}>
                Remaining after payment:{" "}
                <Text style={{ fontWeight: "700" }}>
                  {formatAmount(Math.max(0, unbilled - totalRepaid - Number(amount)), settings.currency)}
                </Text>
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Bill payment"
            placeholderTextColor={COLORS.textMuted}
          />

          <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleAdd}
              onPressIn={pressIn}
              onPressOut={pressOut}
            >
              <Feather name="plus-circle" size={18} color={COLORS.textInverse} />
              <Text style={styles.addBtnTxt}>Record Repayment</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Repayment history */}
        {cycleRepayments.length > 0 && (
          <>
            <Text style={styles.historyTitle}>
              History for this cycle ({cycleRepayments.length})
            </Text>
            {cycleRepayments.map((r: Repayment) => (
              <View key={r.id}>{renderRepayment({ item: r })}</View>
            ))}
          </>
        )}

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModal !== null} animationType="slide" transparent onRequestClose={() => setEditModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Repayment</Text>
              <TouchableOpacity onPress={() => setEditModal(null)}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
            />
            <Text style={styles.fieldLabel}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="e.g. Bill payment"
              placeholderTextColor={COLORS.textMuted}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModal(null)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <Modal visible={deleteId !== null} animationType="fade" transparent onRequestClose={() => setDeleteId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIcon, { backgroundColor: COLORS.dangerLight }]}>
              <Feather name="trash-2" size={24} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Repayment?</Text>
            <Text style={styles.modalBody}>This will remove the repayment record permanently.</Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteId(null)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: COLORS.dangerLight }]}
                onPress={() => {
                  if (deleteId) deleteRepayment(deleteId);
                  setDeleteId(null);
                }}
              >
                <Text style={[styles.saveTxt, { color: COLORS.danger }]}>Delete</Text>
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
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
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
  container: { padding: SPACING.md },

  selectorCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  fieldLabel: { ...TYPOGRAPHY.caption, color: COLORS.textSecondary, marginBottom: 4 },

  afterRepayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  afterRepayTxt: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success,
    flex: 1,
  },

  balanceCard: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    borderLeftWidth: 4,
    ...SHADOWS.sm,
  },
  balanceItem: { flex: 1, padding: SPACING.md, alignItems: "center" },
  balanceVal: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  balanceLbl: { ...TYPOGRAPHY.micro, marginTop: 2, textAlign: "center" },
  balanceDiv: { width: 1, backgroundColor: COLORS.border },

  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  formTitle: { ...TYPOGRAPHY.h4, marginBottom: SPACING.sm },
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
  addBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.xs,
    ...SHADOWS.sm,
  },
  addBtnTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse },

  historyTitle: {
    ...TYPOGRAPHY.h4,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },
  repaymentItem: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    ...SHADOWS.xs,
  },
  repaymentIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  repaymentContent: { flex: 1 },
  repaymentAmount: { ...TYPOGRAPHY.bodyBold },
  repaymentDate: { ...TYPOGRAPHY.caption, marginTop: 2 },
  repaymentDesc: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 1 },
  repaymentActions: { flexDirection: "row", gap: SPACING.xs },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modal shared
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
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
    alignSelf: "center",
  },
  modalTitle: { ...TYPOGRAPHY.h3 },
  modalBody: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginVertical: SPACING.sm },
  modalBtns: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
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

export default RepayToCardScreen;

