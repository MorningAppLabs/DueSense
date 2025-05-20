import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { Picker } from "@react-native-picker/picker"; // Updated import
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import { Transaction, Card } from "../types/types";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import TransactionCard from "../components/TransactionCard";

const MoneyOwedScreen: React.FC = () => {
  const { transactions, settings, persons } = useStore();
  const [personFilter, setPersonFilter] = useState("");

  // Animation setup using Animated
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Filter and sort transactions for money owed (latest date first)
  const getOwedTransactions = () => {
    let filtered = transactions.filter(
      (t: Transaction) => t.forWhom === "Someone Else" && !t.repaid
    );
    if (personFilter) {
      filtered = filtered.filter(
        (t: Transaction) => t.personName === personFilter
      );
    }
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Calculate total owed amount
  const getTotalOwed = () => {
    return getOwedTransactions().reduce(
      (sum: number, t: Transaction) => sum + t.amount,
      0
    );
  };

  // Handle marking a transaction as repaid
  const handleMarkRepaid = (id: string) => {
    useStore.setState((state: { transactions: Transaction[] }) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, repaid: true } : t
      ),
    }));
    Alert.alert("Success", "Transaction marked as repaid!");
  };

  // Show confirmation dialog before marking as repaid
  const confirmMarkRepaid = (id: string) => {
    Alert.alert(
      "Confirm Repayment",
      "Are you sure you want to mark this transaction as repaid?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: () => handleMarkRepaid(id),
        },
      ],
      { cancelable: true }
    );
  };

  // Generate formatted reminder text (sorted by latest date first)
  const generateReminderText = (transactions: Transaction[]) => {
    const sortedTransactions = [...transactions].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    const details = sortedTransactions
      .map(
        (t) =>
          `- ${t.date}: ${
            useStore.getState().cards.find((c: Card) => c.id === t.cardId)
              ?.name || t.cardId
          }, ${t.merchant}, ${t.description}, ${settings.currency}${t.amount}`
      )
      .join("\n");
    return `${transactions[0]?.personName || "Recipient"}, you owe ${
      settings.currency
    }${getTotalOwed()}. Details:\n${details}\nPlease repay as I need to pay the bill.`;
  };

  // Handle sending reminders via WhatsApp, Telegram, or Email
  const handleSendReminder = async (
    type: "WhatsApp" | "Telegram" | "Email",
    transactions: Transaction[]
  ) => {
    if (!transactions.length) {
      Alert.alert("Error", "No transactions to share.");
      return;
    }
    const text = generateReminderText(transactions);
    try {
      if (type === "WhatsApp") {
        await Linking.openURL(
          `whatsapp://send?text=${encodeURIComponent(text)}`
        );
      } else if (type === "Telegram") {
        await Linking.openURL(`tg://msg?text=${encodeURIComponent(text)}`);
      } else if (type === "Email") {
        await Linking.openURL(
          `mailto:?subject=Owed Money Reminder&body=${encodeURIComponent(text)}`
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        `Failed to open ${type}. Please ensure the app is installed.`
      );
    }
  };

  // Handle sharing reminder as a text file
  const handleShare = async (transactions: Transaction[]) => {
    if (!transactions.length) {
      Alert.alert("Error", "No transactions to share.");
      return;
    }
    const text = generateReminderText(transactions);
    const fileUri = `${FileSystem.cacheDirectory}owed_reminder.txt`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, text);
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle: "Share Owed Money Reminder",
      });
    } catch (error) {
      Alert.alert("Error", "Failed to create or share the reminder file.");
    }
  };

  // Render each owed transaction
  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionWrapper}>
      <TransactionCard
        transaction={item}
        showCardName={true}
        showPerson={true}
      />
      <View style={styles.transactionActions}>
        <Animated.View
          style={[styles.repaidButton, { transform: [{ scale }] }]}
        >
          <TouchableOpacity
            onPress={() => confirmMarkRepaid(item.id)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Mark as Repaid"
            accessibilityRole="button"
          >
            <Text style={styles.repaidButtonText}>Mark as Repaid</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Money Owed</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={personFilter}
          onValueChange={(value) => setPersonFilter(value)}
          style={styles.picker}
        >
          <Picker.Item label="Filter by Person" value="" />
          <Picker.Item label="All" value="" />
          {persons.map((p: string) => (
            <Picker.Item key={p} label={p} value={p} />
          ))}
        </Picker>
      </View>
      <View style={styles.totalOwedContainer}>
        <Text style={styles.totalOwed}>
          Total Owed: {settings.currency}
          {getTotalOwed()}
        </Text>
        {personFilter && (
          <View style={styles.icons}>
            <TouchableOpacity
              onPress={() =>
                handleSendReminder("WhatsApp", getOwedTransactions())
              }
              accessibilityLabel="Send WhatsApp Reminder"
              accessibilityRole="button"
            >
              <Feather name="message-circle" size={24} color="#25D366" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                handleSendReminder("Telegram", getOwedTransactions())
              }
              accessibilityLabel="Send Telegram Reminder"
              accessibilityRole="button"
            >
              <Feather name="send" size={24} color="#0088CC" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSendReminder("Email", getOwedTransactions())}
              accessibilityLabel="Send Email Reminder"
              accessibilityRole="button"
            >
              <Feather name="mail" size={24} color="#D81B60" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleShare(getOwedTransactions())}
              accessibilityLabel="Share Reminder"
              accessibilityRole="button"
            >
              <Feather name="share-2" size={24} color="#666666" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <FlatList
        data={getOwedTransactions()}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
    padding: 16,
  },
  header: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  totalOwedContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalOwed: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#D32F2F",
  },
  list: {
    flex: 1,
  },
  transactionWrapper: {
    marginBottom: 8,
  },
  transactionActions: {
    marginTop: 8,
    alignItems: "flex-end",
    paddingRight: 12,
  },
  repaidButton: {
    backgroundColor: "#388E3C",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  repaidButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  icons: {
    flexDirection: "row",
    gap: 12,
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  picker: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
  },
});

export default MoneyOwedScreen;
