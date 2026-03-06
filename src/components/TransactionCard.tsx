import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import { Transaction, Card } from "../types/types";
import moment from "moment";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from "../theme/theme";
import { getCategoryIconFull } from "../constants/categoryIcons";

interface TransactionCardProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  showCardName?: boolean;
  showPerson?: boolean;
  showStatus?: boolean;
  showCashback?: boolean;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
  showCardName = false,
  showPerson = false,
  showStatus = false,
  showCashback = false,
}) => {
  const { settings, cards, categories } = useStore();
  const [deleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.98, friction: 8, tension: 40, useNativeDriver: true }).start();

  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();

  const cardData = cards.find((c: Card) => c.id === transaction.cardId);
  const cardName = cardData?.name ?? transaction.cardId;
  const cardColor = cardData?.color ?? COLORS.primary;

  const isPaid = transaction.repaid;
  const isForOther = transaction.forWhom === "Someone Else";
  const categoryIcon = getCategoryIconFull(transaction.category, categories);

  const accentColor = isPaid ? COLORS.success : isForOther ? COLORS.warning : COLORS.primary;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      <View style={[styles.iconWrap, { backgroundColor: accentColor + "18" }]}>
        <Feather name={categoryIcon} size={20} color={accentColor} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.merchant} numberOfLines={1}>
            {transaction.merchant || "Unknown"}
          </Text>
          <Text style={[styles.amount, { color: isPaid ? COLORS.textSecondary : COLORS.text }]}>
            {settings.currency}
            {transaction.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </Text>
        </View>

        <Text style={styles.description} numberOfLines={1}>
          {transaction.description}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {moment(transaction.date, "YYYY-MM-DD").format("DD MMM YYYY")}
          </Text>
          {transaction.category ? (
            <>
              <Text style={styles.metaDot}> · </Text>
              <Text style={styles.meta}>{transaction.category}</Text>
            </>
          ) : null}
          {transaction.paymentType === "EMI" ? (
            <>
              <Text style={styles.metaDot}> · </Text>
              <Text style={[styles.meta, { color: COLORS.info }]}>EMI</Text>
            </>
          ) : null}
        </View>

        <View style={styles.badgeRow}>
          {showCardName && (
            <View style={[styles.badge, { backgroundColor: cardColor + "22" }]}>
              <Feather name="credit-card" size={9} color={cardColor} />
              <Text style={[styles.badgeText, { color: cardColor }]}>{cardName}</Text>
            </View>
          )}
          {showPerson && isForOther && (
            <View style={[styles.badge, { backgroundColor: COLORS.warningLight }]}>
              <Feather name="user" size={9} color={COLORS.warning} />
              <Text style={[styles.badgeText, { color: COLORS.warning }]}>
                {transaction.personName ?? "—"}
              </Text>
            </View>
          )}
          {showStatus && (
            <View style={[styles.badge, { backgroundColor: isPaid ? COLORS.successLight : COLORS.dangerLight }]}>
              <Text style={[styles.badgeText, { color: isPaid ? COLORS.success : COLORS.danger }]}>
                {isPaid ? "Paid" : "Due"}
              </Text>
            </View>
          )}
          {showCashback && (transaction.cashback ?? 0) > 0 && (
            <View style={[styles.badge, { backgroundColor: COLORS.successLight }]}>
              <Feather name="trending-up" size={9} color={COLORS.success} />
              <Text style={[styles.badgeText, { color: COLORS.success }]}>
                {settings.currency}
                {(transaction.cashback ?? 0).toFixed(2)} CB
              </Text>
            </View>
          )}
        </View>
      </View>

      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              onPress={() => onEdit(transaction)}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.actionBtn}
              accessibilityLabel="Edit Transaction"
            >
              <Feather name="edit-2" size={15} color={COLORS.primary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={() => setDeleteModalVisible(true)}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.actionBtn}
              accessibilityLabel="Delete Transaction"
            >
              <Feather name="trash-2" size={15} color={COLORS.danger} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIcon, { backgroundColor: COLORS.dangerLight }]}>
              <Feather name="trash-2" size={24} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Transaction?</Text>
            <Text style={styles.modalBody}>
              Permanently remove the transaction for{" "}
              <Text style={{ fontFamily: "Inter_700Bold", color: COLORS.text }}>
                {transaction.merchant}
              </Text>
              . This cannot be undone.
            </Text>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
              >
                <Text style={styles.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  onDelete?.(transaction.id);
                }}
              >
                <Text style={styles.modalDeleteTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  accentBar: {
    width: 3,
    alignSelf: "stretch",
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: SPACING.sm,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  merchant: {
    ...TYPOGRAPHY.bodySemiBold,
    flex: 1,
    marginRight: SPACING.sm,
  },
  amount: {
    ...TYPOGRAPHY.bodyBold,
    flexShrink: 0,
  },
  description: {
    ...TYPOGRAPHY.caption,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  meta: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textMuted,
  },
  metaDot: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textMuted,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
    gap: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  badgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
  },
  actions: {
    flexDirection: "column",
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  actionBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.borderLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    width: "100%",
    alignItems: "center",
    ...SHADOWS.lg,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.sm,
  },
  modalBody: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginBottom: SPACING.lg,
  },
  modalBtns: {
    flexDirection: "row",
    gap: SPACING.sm,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    backgroundColor: COLORS.borderLight,
    alignItems: "center",
  },
  modalCancelTxt: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textSecondary,
  },
  modalDeleteBtn: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    backgroundColor: COLORS.dangerLight,
    alignItems: "center",
  },
  modalDeleteTxt: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.danger,
  },
});

export default TransactionCard;
