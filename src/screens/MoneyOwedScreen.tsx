import React, { useState, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  Animated,
  Modal,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Dropdown from "../components/Dropdown";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import { Transaction, Card } from "../types/types";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import TransactionCard from "../components/TransactionCard";
import { cancelNotificationById } from "../utils/notifications";
import { formatAmount } from "../utils/billingUtils";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";

interface PersonSection {
  person: string;
  total: number;
  transactions: Transaction[];
}

const MoneyOwedScreen: React.FC = () => {
  const { transactions, settings, persons, notificationIds, cards } = useStore();
  const [personFilter, setPersonFilter] = useState("");
  const [reminderModal, setReminderModal] = useState<PersonSection | null>(null);
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, friction: 8, tension: 40, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();

  // Group un-repaid "for someone else" transactions by person
  const sections: PersonSection[] = useMemo(() => {
    const owedTxs = transactions.filter(
      (t: Transaction) => t.forWhom === "Someone Else" && !t.repaid
    );
    const grouped: Record<string, Transaction[]> = {};
    owedTxs.forEach((t: Transaction) => {
      const name = t.personName ?? "Unknown";
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(t);
    });
    return Object.entries(grouped)
      .map(([person, txs]) => ({
        person,
        total: txs.reduce((s, t) => s + t.amount, 0),
        transactions: txs.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .filter((s) => !personFilter || s.person === personFilter)
      .sort((a, b) => b.total - a.total);
  }, [transactions, personFilter]);

  const grandTotal = useMemo(
    () => sections.reduce((s, sec) => s + sec.total, 0),
    [sections]
  );

  const handleMarkRepaid = async (id: string) => {
    const { transactions: txs, updateTransaction, setState } = useStore.getState();
    const notifId = notificationIds["owedMoney_" + id];
    if (notifId) {
      await cancelNotificationById(notifId);
      // Use the store's setState action so the change is persisted to AsyncStorage
      const updatedIds = { ...useStore.getState().notificationIds };
      delete updatedIds["owedMoney_" + id];
      setState({ notificationIds: updatedIds });
    }
    const tx = txs.find((t) => t.id === id);
    if (tx) updateTransaction({ ...tx, repaid: true });
    Alert.alert("Marked as Repaid", "The transaction has been marked as repaid.");
  };

  const confirmRepaid = (id: string) =>
    Alert.alert(
      "Mark as Repaid",
      "Confirm this transaction has been repaid?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => handleMarkRepaid(id) },
      ],
      { cancelable: true }
    );

  const generateReminderText = (section: PersonSection): string => {
    const separator = "━".repeat(22);
    const lines = section.transactions.map((t) => {
      const cardName = cards.find((c: Card) => c.id === t.cardId)?.name ?? t.cardId;
      return (
        `🗓 ${t.date} | 🏪 ${t.merchant}\n` +
        `📁 ${t.category} · 💳 ${cardName}\n` +
        (t.description ? `📝 ${t.description}\n` : "") +
        `💰 ${settings.currency}${t.amount.toFixed(2)}`
      );
    });
    const count = lines.length;
    return (
      `🔔 *Payment Reminder*\n\n` +
      `Hi ${section.person},\n\n` +
      `I paid for you on the following ${count > 1 ? count + " occasions" : "occasion"} and the total outstanding is *${settings.currency}${section.total.toFixed(2)}*:\n\n` +
      lines.map((l) => `${separator}\n${l}`).join("\n\n") + `\n${separator}\n\n` +
      `💵 *Total Due: ${settings.currency}${section.total.toFixed(2)}*\n\n` +
      `Please transfer at your earliest convenience. Thank you! 🙏\n\n` +
      `_Sent via DueSense_`
    );
  };

  const handleSendApp = async (type: "WhatsApp" | "Telegram" | "Email", section: PersonSection) => {
    const text = generateReminderText(section);
    try {
      if (type === "WhatsApp") {
        await Linking.openURL("whatsapp://send?text=" + encodeURIComponent(text));
      } else if (type === "Telegram") {
        await Linking.openURL("tg://msg?text=" + encodeURIComponent(text));
      } else {
        await Linking.openURL("mailto:?subject=Money Owed Reminder&body=" + encodeURIComponent(text));
      }
    } catch {
      Alert.alert("Error", "Could not open " + type + ". Make sure it is installed.");
    }
  };

  const handleShareFile = async (section: PersonSection) => {
    const text = generateReminderText(section);
    const fileUri = (FileSystem.cacheDirectory ?? "") + "owed_reminder.txt";
    try {
      await FileSystem.writeAsStringAsync(fileUri, text);
      await Sharing.shareAsync(fileUri, { mimeType: "text/plain", dialogTitle: "Share Reminder" });
    } catch {
      Alert.alert("Error", "Failed to create reminder file.");
    }
  };

  const allPersons = useMemo(
    () => Array.from(new Set(persons.concat(
      transactions.filter((t: Transaction) => t.forWhom === "Someone Else" && t.personName)
        .map((t: Transaction) => t.personName as string)
    ))).sort(),
    [persons, transactions]
  );

  const renderSectionHeader = ({ section }: { section: { title: string; sectionData: PersonSection } }) => {
    const sec = section.sectionData;
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.personAvatar}>
          <Text style={styles.personAvatarTxt}>{sec.person.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.personInfo}>
          <Text style={styles.personName}>{sec.person}</Text>
          <Text style={styles.personTotal}>{formatAmount(sec.total, settings.currency)} owed</Text>
        </View>
        <TouchableOpacity
          style={styles.reminderBtn}
          onPress={() => setReminderModal(sec)}
          accessibilityLabel="Send reminder"
        >
          <Feather name="send" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.txRow}>
      <TransactionCard transaction={item} showCardName showPerson showCashback />
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          style={styles.repaidBtn}
          onPress={() => confirmRepaid(item.id)}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityLabel="Mark as repaid"
        >
          <Feather name="check-circle" size={14} color={COLORS.success} />
          <Text style={styles.repaidTxt}>Mark Repaid</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // Convert sections to SectionList format
  const sectionListData = sections.map((s) => ({
    title: s.person,
    sectionData: s,
    data: s.transactions,
  }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Money Owed</Text>
        {grandTotal > 0 && (
          <View style={styles.totalChip}>
            <Text style={styles.totalChipTxt}>{formatAmount(grandTotal, settings.currency)}</Text>
          </View>
        )}
      </View>

      {/* Person filter */}
      <View style={styles.filterCard}>
        <Dropdown
          placeholder="All people"
          items={allPersons.map((p) => ({ label: p, value: p }))}
          selectedValue={personFilter}
          onValueChange={(v) => setPersonFilter(v as string)}
          searchable={allPersons.length > 5}
        />
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="users" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No money owed</Text>
          <Text style={styles.emptySub}>
            {personFilter
              ? personFilter + " has no pending amounts."
              : "When you pay for someone else, it appears here."}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sectionListData}
          keyExtractor={(item) => item.id}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderTransaction}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Reminder options modal */}
      <Modal
        visible={reminderModal !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setReminderModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Send Reminder to {reminderModal?.person}
              </Text>
              <TouchableOpacity onPress={() => setReminderModal(null)}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {reminderModal && (
              <View style={styles.modalAmountRow}>
                <Text style={styles.modalAmountLabel}>Amount owed:</Text>
                <Text style={styles.modalAmount}>
                  {formatAmount(reminderModal.total, settings.currency)}
                </Text>
              </View>
            )}

            <View style={styles.reminderOptions}>
              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: "#25D36620" }]}
                onPress={() => { reminderModal && handleSendApp("WhatsApp", reminderModal); setReminderModal(null); }}
              >
                <View style={[styles.reminderOptionIcon, { backgroundColor: "#25D366" }]}>
                  <Feather name="message-circle" size={20} color="#fff" />
                </View>
                <Text style={styles.reminderOptionTxt}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: "#2AABEE20" }]}
                onPress={() => { reminderModal && handleSendApp("Telegram", reminderModal); setReminderModal(null); }}
              >
                <View style={[styles.reminderOptionIcon, { backgroundColor: "#2AABEE" }]}>
                  <Feather name="send" size={20} color="#fff" />
                </View>
                <Text style={styles.reminderOptionTxt}>Telegram</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: COLORS.primaryLight }]}
                onPress={() => { reminderModal && handleSendApp("Email", reminderModal); setReminderModal(null); }}
              >
                <View style={[styles.reminderOptionIcon, { backgroundColor: COLORS.primary }]}>
                  <Feather name="mail" size={20} color="#fff" />
                </View>
                <Text style={styles.reminderOptionTxt}>Email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.reminderOption, { backgroundColor: COLORS.surfaceAlt }]}
                onPress={() => { reminderModal && handleShareFile(reminderModal); setReminderModal(null); }}
              >
                <View style={[styles.reminderOptionIcon, { backgroundColor: COLORS.textSecondary }]}>
                  <Feather name="share-2" size={20} color="#fff" />
                </View>
                <Text style={styles.reminderOptionTxt}>Share</Text>
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
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  screenTitle: { ...TYPOGRAPHY.h2 },
  totalChip: {
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  totalChipTxt: { fontFamily: "Inter_700Bold", fontSize: 13, color: COLORS.danger },

  filterCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  picker: { height: 44 },

  listContent: { padding: SPACING.md, paddingBottom: 100 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  personAvatar: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  personAvatarTxt: { fontFamily: "Inter_700Bold", fontSize: 18, color: COLORS.primary },
  personInfo: { flex: 1 },
  personName: { ...TYPOGRAPHY.h4 },
  personTotal: { ...TYPOGRAPHY.caption, color: COLORS.danger, marginTop: 2 },
  reminderBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  txRow: { marginBottom: SPACING.xs },
  repaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: COLORS.successLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    gap: 6,
    marginBottom: SPACING.sm,
  },
  repaidTxt: { fontFamily: "Inter_700Bold", fontSize: 12, color: COLORS.success },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  emptyTitle: { ...TYPOGRAPHY.h3, color: COLORS.textSecondary },
  emptySub: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: "center" },

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
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { ...TYPOGRAPHY.h3 },
  modalAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.dangerLight,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  modalAmountLabel: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  modalAmount: { ...TYPOGRAPHY.bodyBold, color: COLORS.danger },
  reminderOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  reminderOption: {
    flex: 1,
    minWidth: "40%",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: SPACING.xs,
  },
  reminderOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderOptionTxt: { ...TYPOGRAPHY.captionBold, color: COLORS.text },
});

export default MoneyOwedScreen;

