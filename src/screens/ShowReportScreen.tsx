import React, { useState, useEffect, useCallback } from "react"; // Import useCallback
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  ScrollView, // Added ScrollView for modal content
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useStore } from "../store/store";
import { Transaction, Card, CashbackRule } from "../types/types"; // Import CashbackRule
import moment from "moment";
import TransactionCard from "../components/TransactionCard";
import {
  scheduleDueDateReminder,
  cancelNotificationById,
  scheduleOwedMoneyReminder,
  scheduleGeneralOwedMoneyReminder,
} from "../utils/notifications";

const { width } = Dimensions.get("window");

const ShowReportScreen: React.FC = () => {
  const {
    cards,
    transactions,
    settings,
    notificationIds,
    repayments,
    merchants, // Get merchants from store
    categories, // Get categories from store
    addMerchant, // Get addMerchant action
    addCategory, // Get addCategory action
    updateTransaction, // Get updateTransaction action
  } = useStore();
  const [cardId, setCardId] = useState("");
  const [billingCycle, setBillingCycle] = useState("current");
  const [personFilter, setPersonFilter] = useState("");
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // State for edited transaction details
  const [editedAmount, setEditedAmount] = useState("");
  const [editedMerchant, setEditedMerchant] = useState("");
  const [useCustomEditedMerchant, setUseCustomEditedMerchant] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [useCustomEditedCategory, setUseCustomEditedCategory] = useState(false);
  const [editedCashback, setEditedCashback] = useState(0); // State for dynamic cashback

  // Get unique merchants from store and cards (similar to YourCardsScreen)
  const uniqueMerchants = Array.from(
    new Set([
      ...merchants.map((m) => m.toUpperCase()),
      ...cards
        .flatMap((card) => card.cashbackRules.map((r) => r.merchant))
        .filter((m) => m)
        .map((m) => m.toUpperCase()),
    ])
  ).sort();

  // Get unique categories from store and cards (similar to YourCardsScreen)
  const uniqueCategories = Array.from(
    new Set([
      ...categories.map((c) => c.toUpperCase()),
      ...cards
        .flatMap((card) => card.cashbackRules.flatMap((r) => r.categories))
        .filter((c) => c)
        .map((c) => c.toUpperCase()),
    ])
  ).sort();

  // Calculate billing cycle dates
  const getBillingCycleDates = (card: Card, transactionDate: string) => {
    const date = moment(transactionDate, "YYYY-MM-DD");
    const year = date.year();
    const month = date.month() + 1;
    const startDay = card.billingCycle.start;
    const endDay = card.billingCycle.end;
    let cycleStart, cycleEnd;
    if (startDay <= endDay) {
      cycleStart = moment(`${year}-${month}-${startDay}`, "YYYY-MM-DD");
      cycleEnd = moment(`${year}-${month}-${endDay}`, "YYYY-MM-DD");
    } else {
      cycleStart = moment(`${year}-${month}-${startDay}`, "YYYY-MM-DD");
      cycleEnd = moment(`${year}-${month}-${endDay}`, "YYYY-MM-DD").add(
        1,
        "month"
      );
    }
    if (date.isBefore(cycleStart)) {
      cycleStart.subtract(1, "month");
      cycleEnd.subtract(1, "month");
    } else if (date.isAfter(cycleEnd)) {
      cycleStart.add(1, "month");
      cycleEnd.add(1, "month");
    }
    return { start: cycleStart, end: cycleEnd };
  };

  // Generate billing cycle options
  const getBillingCycles = (cardId: string) => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return [{ label: "Current", value: "current" }];

    const today = moment();
    const currentCycle = getBillingCycleDates(card, today.format("YYYY-MM-DD"));
    const currentLabel = `Current (${currentCycle.start.format(
      "DD MMM YYYY"
    )} - ${currentCycle.end.format("DD MMM YYYY")})`;

    const cardTransactions = transactions.filter(
      (t: Transaction) => t.cardId === cardId
    );
    const cycles: { start: moment.Moment; end: moment.Moment }[] = [];
    cardTransactions.forEach((t) => {
      const cycle = getBillingCycleDates(card, t.date);
      if (
        !cycles.some(
          (c) =>
            c.start.isSame(cycle.start, "day") && c.end.isSame(cycle.end, "day")
        )
      ) {
        cycles.push(cycle);
      }
    });

    const sortedCycles = cycles.sort((a, b) => b.start.diff(a.start));
    const options = [
      { label: currentLabel, value: "current" },
      ...sortedCycles
        .filter(
          (c) =>
            !c.start.isSame(currentCycle.start, "day") ||
            !c.end.isSame(currentCycle.end, "day")
        )
        .map((c) => ({
          label: `${c.start.format("DD MMM YYYY")} - ${c.end.format(
            "DD MMM YYYY"
          )}`,
          value: `${c.start.format("YYYY-MM-DD")}|${c.end.format(
            "YYYY-MM-DD"
          )}`,
        })),
    ];

    return options;
  };

  // Filter transactions by card, person, and billing cycle
  const getFilteredTransactions = () => {
    let filtered = transactions.filter((t: Transaction) => t.cardId === cardId);

    if (personFilter) {
      filtered = filtered.filter(
        (t: Transaction) =>
          t.personName === personFilter ||
          (!t.personName && personFilter === "Myself")
      );
    }

    if (billingCycle !== "current") {
      const [startDate, endDate] = billingCycle.split("|");
      const start = moment(startDate, "YYYY-MM-DD");
      const end = moment(endDate, "YYYY-MM-DD");
      filtered = filtered.filter((t) =>
        moment(t.date, "YYYY-MM-DD").isBetween(start, end, undefined, "[]")
      );
    } else {
      const card = cards.find((c: Card) => c.id === cardId);
      if (card) {
        const currentCycle = getBillingCycleDates(
          card,
          moment().format("YYYY-MM-DD")
        );
        filtered = filtered.filter((t) =>
          moment(t.date, "YYYY-MM-DD").isBetween(
            currentCycle.start,
            currentCycle.end,
            undefined,
            "[]"
          )
        );
      }
    }

    const grouped: { [key: string]: Transaction[] } = {};
    filtered.forEach((t: Transaction) => {
      const date = t.date;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(t);
    });
    return Object.entries(grouped).sort(([a], [b]) =>
      moment(b).diff(moment(a))
    );
  };

  // Calculate summary for the selected billing cycle
  const getSummary = useCallback(() => {
    // Memoize with useCallback
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) {
      return { totalSpent: 0, unbilled: 0, repaid: 0, totalCashback: 0 };
    }

    let start: moment.Moment, end: moment.Moment;
    if (billingCycle === "current") {
      const currentCycle = getBillingCycleDates(
        card,
        moment().format("YYYY-MM-DD")
      );
      start = currentCycle.start;
      end = currentCycle.end;
    } else {
      const [startDate, endDate] = billingCycle.split("|");
      start = moment(startDate, "YYYY-MM-DD");
      end = moment(endDate, "YYYY-MM-DD");
    }

    const cardTransactions = transactions.filter(
      (t: Transaction) =>
        t.cardId === cardId &&
        moment(t.date, "YYYY-MM-DD").isBetween(start, end, undefined, "[]")
    );
    const totalSpent = cardTransactions.reduce(
      (sum: number, t: Transaction) => sum + t.amount,
      0
    );

    const totalRepaid = repayments
      .filter(
        (r: { cardId: string; billingCycleStart?: string }) =>
          r.cardId === cardId &&
          r.billingCycleStart &&
          moment(r.billingCycleStart, "YYYY-MM-DD").isSame(start, "day")
      )
      .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

    const totalCashback = cardTransactions.reduce(
      (sum: number, t: Transaction) => sum + (t.cashback || 0),
      0
    );

    return {
      totalSpent,
      unbilled: totalSpent - totalRepaid,
      repaid: totalRepaid,
      totalCashback,
    };
  }, [cardId, billingCycle, cards, transactions, repayments]); // Add dependencies

  // Calculate cashback for the edited transaction
  const calculateEditedCashback = useCallback(() => {
    // Memoize with useCallback
    if (!editTransaction || !editedAmount || !editedMerchant || !editedCategory)
      return 0;

    const card = cards.find((c: Card) => c.id === editTransaction.cardId);
    if (!card || !card.cashbackRules.length) return 0;

    const rule = card.cashbackRules.find(
      (r) =>
        (r.onlineOffline === editTransaction.onlineOffline ||
          r.onlineOffline === "Both") &&
        r.paymentType === editTransaction.paymentType &&
        (!r.merchant ||
          r.merchant.toUpperCase() === editedMerchant.toUpperCase()) &&
        (!r.categories.length ||
          r.categories.includes(editedCategory.toUpperCase()))
    );

    if (!rule) return 0;

    // Need to consider the billing cycle of the transaction date for the limit calculation
    const { start, end } = getBillingCycleDates(card, editTransaction.date);

    const earned = card.cashbackRules
      .filter(
        (r) =>
          r === rule && // Match the specific rule
          (r.onlineOffline === editTransaction.onlineOffline ||
            r.onlineOffline === "Both") &&
          r.paymentType === editTransaction.paymentType &&
          (!r.merchant ||
            r.merchant.toUpperCase() === editedMerchant.toUpperCase()) &&
          (!r.categories.length ||
            r.categories.includes(editedCategory.toUpperCase()))
      )
      .reduce((sum, r) => {
        const transactionsInCycle = useStore.getState().transactions.filter(
          (t) =>
            t.cardId === card.id &&
            moment(t.date, "YYYY-MM-DD").isBetween(
              start,
              end,
              undefined,
              "[]"
            ) &&
            // Only include other transactions matching this rule for the limit calculation
            t.id !== editTransaction.id && // Exclude the current transaction being edited
            (r.onlineOffline === t.onlineOffline ||
              r.onlineOffline === "Both") &&
            r.paymentType === t.paymentType &&
            (!r.merchant ||
              r.merchant.toUpperCase() === t.merchant.toUpperCase()) &&
            (!r.categories.length ||
              r.categories.includes(t.category.toUpperCase()))
        );
        return (
          sum + transactionsInCycle.reduce((s, t) => s + (t.cashback || 0), 0)
        );
      }, 0);

    const potentialCashback = (Number(editedAmount) * rule.percentage) / 100;
    const remaining = Math.max(0, (rule.limit || Infinity) - earned);

    return Math.min(potentialCashback, remaining);
  }, [
    editTransaction,
    editedAmount,
    editedMerchant,
    editedCategory,
    cards,
    transactions,
  ]); // Add dependencies

  // Effect to update edited cashback when relevant fields change
  useEffect(() => {
    setEditedCashback(calculateEditedCashback());
  }, [editedAmount, editedMerchant, editedCategory, calculateEditedCashback]); // Add dependencies

  // Schedule dueDate, billEmi, and general owedMoney reminders when cardId or billingCycle changes
  useEffect(() => {
    if (!cardId) return;

    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return;

    const scheduleNotifications = async () => {
      let start: moment.Moment, end: moment.Moment;
      if (billingCycle === "current") {
        const currentCycle = getBillingCycleDates(
          card,
          moment().format("YYYY-MM-DD")
        );
        start = currentCycle.start;
        end = currentCycle.end;
      } else {
        const [startDate, endDate] = billingCycle.split("|");
        start = moment(startDate, "YYYY-MM-DD");
        end = moment(endDate, "YYYY-MM-DD");
      }

      // Due Date Reminder (on cycle end date)
      const dueDate = end.toDate();
      const dueDateKey = `dueDate_${cardId}_${start.format("YYYY-MM-DD")}`;
      if (!notificationIds[dueDateKey]) {
        const identifier = await scheduleDueDateReminder(
          card.name,
          dueDate,
          settings.notificationTimes.dueDate
        );
        if (identifier) {
          useStore.getState().setState({
            notificationIds: {
              ...notificationIds,
              [dueDateKey]: identifier,
            },
          });
        } else {
          console.warn(
            `No identifier returned for due date notification: ${dueDateKey}`
          );
        }
      }

      // Removed Bill/EMI reminder to avoid duplicate notifications.
      // Bill/EMI notifications were consolidated; due date reminder is used instead.

      // General Owed-Money Reminder (10 days after cycle end)
      const owedDate = moment(end).add(10, "days").toDate();
      const owedKey = `generalOwedMoney_${cardId}_${end.format("YYYY-MM-DD")}`;
      if (!notificationIds[owedKey]) {
        const identifier = await scheduleGeneralOwedMoneyReminder(
          owedDate,
          settings.notificationTimes.owedMoney
        );
        if (identifier) {
          useStore.getState().setState({
            notificationIds: {
              ...notificationIds,
              [owedKey]: identifier,
            },
          });
        } else {
          console.warn(
            `No identifier returned for general owed money notification: ${owedKey}`
          );
        }
      }
    };

    scheduleNotifications().catch((error) => {
      console.error("Failed to schedule notifications:", error);
    });
  }, [
    cardId,
    billingCycle,
    cards,
    settings.notificationTimes,
    notificationIds,
    getBillingCycleDates, // Add dependency
  ]);

  // Handle edit
  const handleEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
    setEditedAmount(transaction.amount.toString());
    setEditedMerchant(transaction.merchant);
    setUseCustomEditedMerchant(
      !uniqueMerchants.includes(transaction.merchant.toUpperCase()) &&
        transaction.merchant !== ""
    );
    setEditedDescription(transaction.description);
    setEditedCategory(transaction.category);
    setUseCustomEditedCategory(
      !uniqueCategories.includes(transaction.category.toUpperCase()) &&
        transaction.category !== ""
    );
    // Cashback will be calculated by the useEffect based on these values
  };

  // Save edited transaction
  const handleSaveEdit = async () => {
    if (
      !editTransaction ||
      !editedAmount ||
      !editedMerchant ||
      !editedDescription ||
      !editedCategory
    ) {
      Alert.alert("Error", "Please fill all required fields.");
      return;
    }

    // Add new custom merchant or category to the store if applicable
    if (useCustomEditedMerchant && editedMerchant) {
      addMerchant(editedMerchant.toUpperCase());
    }
    if (useCustomEditedCategory && editedCategory) {
      addCategory(editedCategory.toUpperCase());
    }

    const updatedTransaction: Transaction = {
      ...editTransaction,
      amount: Number(editedAmount),
      merchant: editedMerchant.toUpperCase(),
      description: editedDescription.toUpperCase(),
      category: editedCategory.toUpperCase(),
      cashback: editedCashback, // Use the dynamically calculated cashback
    };

    // Update the transaction in the store using the new action
    updateTransaction(updatedTransaction);

    const originalTransaction = transactions.find(
      (t) => t.id === editTransaction.id
    );
    if (originalTransaction) {
      const owedMoneyKey = `owedMoney_${editTransaction.id}`;
      const shouldCancel =
        (originalTransaction.forWhom === "Someone Else" &&
          (updatedTransaction.forWhom !== "Someone Else" || // Use updatedTransaction
            updatedTransaction.repaid)) || // Use updatedTransaction
        (originalTransaction.forWhom === "Someone Else" &&
          !originalTransaction.repaid &&
          updatedTransaction.repaid); // Use updatedTransaction

      if (shouldCancel && notificationIds[owedMoneyKey]) {
        await cancelNotificationById(notificationIds[owedMoneyKey]);
        const { [owedMoneyKey]: _, ...newNotificationIds } = notificationIds;
        useStore.getState().setState({
          notificationIds: newNotificationIds,
        });
      }

      if (
        updatedTransaction.forWhom === "Someone Else" && // Use updatedTransaction
        !updatedTransaction.repaid && // Use updatedTransaction
        (originalTransaction.forWhom !== "Someone Else" ||
          originalTransaction.repaid)
      ) {
        const identifier = await scheduleOwedMoneyReminder(
          updatedTransaction.personName || "", // Use updatedTransaction
          updatedTransaction.amount, // Use updatedTransaction
          new Date(updatedTransaction.date), // Use updatedTransaction
          updatedTransaction.id, // Use updatedTransaction
          settings.notificationTimes.owedMoney
        );
        if (identifier) {
          useStore.getState().setState({
            notificationIds: {
              ...notificationIds,
              [owedMoneyKey]: identifier,
            },
          });
        }
      }
    }

    setEditTransaction(null); // Close the modal
    Alert.alert("Success", "Transaction updated successfully!");
  };

  // Handle delete with confirmation
  const handleDelete = async (id: string) => {
    const transaction = transactions.find((t) => t.id === id);
    if (
      transaction &&
      transaction.forWhom === "Someone Else" &&
      !transaction.repaid
    ) {
      const owedMoneyKey = `owedMoney_${id}`;
      if (notificationIds[owedMoneyKey]) {
        await cancelNotificationById(notificationIds[owedMoneyKey]);
        const { [owedMoneyKey]: _, ...newNotificationIds } = notificationIds;
        useStore.getState().setState({
          notificationIds: newNotificationIds,
        });
      }
    }

    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this transaction?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: () => {
            useStore.setState((state: { transactions: Transaction[] }) => ({
              transactions: state.transactions.filter((t) => t.id !== id),
            }));
            setDeleteId(null);
            Alert.alert("Success", "Transaction deleted successfully!");
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Render date group
  const renderDateGroup = ({ item }: { item: [string, Transaction[]] }) => (
    <View>
      <Text style={styles.dateHeader}>
        {moment(item[0]).format("DD MMM YYYY")}
      </Text>
      <FlatList
        data={item[1]}
        renderItem={({ item }) => (
          <TransactionCard
            transaction={item}
            onEdit={handleEdit}
            onDelete={handleDelete}
            showPerson={true}
            showStatus={true}
            showCashback={true} // Added to display cashback
          />
        )}
        keyExtractor={(t) => t.id}
        style={styles.transactionList}
      />
    </View>
  );

  const summary = cardId
    ? getSummary()
    : { totalSpent: 0, unbilled: 0, repaid: 0, totalCashback: 0 };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={cardId}
            onValueChange={(value) => setCardId(value)}
            style={styles.picker}
            accessibilityLabel="Select Credit Card"
            accessibilityRole="combobox"
          >
            <Picker.Item label="Select Credit Card" value="" />
            {cards.map((card: Card) => (
              <Picker.Item key={card.id} label={card.name} value={card.id} />
            ))}
          </Picker>
        </View>
        {cardId && (
          <>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={billingCycle}
                onValueChange={(value) => setBillingCycle(value)}
                style={styles.picker}
                accessibilityLabel="Select Billing Cycle"
                accessibilityRole="combobox"
              >
                {getBillingCycles(cardId).map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            </View>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={personFilter}
                onValueChange={(value) => setPersonFilter(value)}
                style={styles.picker}
                accessibilityLabel="Filter by Person"
                accessibilityRole="combobox"
              >
                <Picker.Item label="Filter by Person" value="" />
                <Picker.Item label="All" value="" />
                <Picker.Item label="Myself" value="Myself" />
                {useStore.getState().persons.map((p: string) => (
                  <Picker.Item key={p} label={p} value={p} />
                ))}
              </Picker>
            </View>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                Total Spent: {settings.currency}
                {summary.totalSpent.toFixed(2)}
              </Text>
              <Text style={styles.summaryText}>
                Unbilled Amount: {settings.currency}
                {summary.unbilled.toFixed(2)}
              </Text>
              <Text style={styles.summaryText}>
                Repaid Amount: {settings.currency}
                {summary.repaid.toFixed(2)}
              </Text>
              <Text style={styles.summaryText}>
                Total Cashback: {settings.currency}
                {summary.totalCashback.toFixed(2)}
              </Text>
            </View>
            <FlatList
              data={getFilteredTransactions()}
              renderItem={renderDateGroup}
              keyExtractor={(item) => item[0]}
              style={styles.list}
            />
          </>
        )}
        {/* Edit Transaction Modal */}
        <Modal
          visible={!!editTransaction}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditTransaction(null)}
        >
          <View style={styles.modalOverlay}>
            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modal}>
                <Text style={styles.modalTitle}>Edit Transaction</Text>

                {/* Amount Input */}
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Amount"
                  keyboardType="numeric"
                  value={editedAmount}
                  onChangeText={setEditedAmount}
                  accessibilityLabel="Transaction Amount"
                />

                {/* Merchant Selection */}
                <Text style={styles.label}>Merchant</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={
                      useCustomEditedMerchant ? "Other" : editedMerchant
                    }
                    onValueChange={(value) => {
                      setEditedMerchant(
                        value === "Other" ? "" : value.toUpperCase()
                      );
                      setUseCustomEditedMerchant(value === "Other");
                    }}
                    style={styles.picker}
                    accessibilityLabel="Select Merchant"
                    accessibilityRole="combobox"
                  >
                    <Picker.Item label="Select Merchant" value="" />
                    {uniqueMerchants.map((m) => (
                      <Picker.Item key={m} label={m} value={m} />
                    ))}
                    <Picker.Item label="Other" value="Other" />
                  </Picker>
                </View>

                {/* Custom Merchant Input */}
                {useCustomEditedMerchant && (
                  <>
                    <Text style={styles.label}>Custom Merchant Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., AMAZON"
                      value={editedMerchant}
                      onChangeText={(text) =>
                        setEditedMerchant(text.replace(/,/g, "").toUpperCase())
                      }
                      accessibilityLabel="Custom Merchant Name"
                    />
                  </>
                )}

                {/* Description Input */}
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., GROCERY SHOPPING"
                  value={editedDescription}
                  onChangeText={setEditedDescription}
                  accessibilityLabel="Transaction Description"
                />

                {/* Category Selection */}
                <Text style={styles.label}>Category</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={
                      useCustomEditedCategory ? "Other" : editedCategory
                    }
                    onValueChange={(value) => {
                      setEditedCategory(
                        value === "Other" ? "" : value.toUpperCase()
                      );
                      setUseCustomEditedCategory(value === "Other");
                    }}
                    style={styles.picker}
                    accessibilityLabel="Select Category"
                    accessibilityRole="combobox"
                  >
                    <Picker.Item label="Select Category" value="" />
                    {uniqueCategories.map((c) => (
                      <Picker.Item key={c} label={c} value={c} />
                    ))}
                    <Picker.Item label="Other" value="Other" />
                  </Picker>
                </View>

                {/* Custom Category Input */}
                {useCustomEditedCategory && (
                  <>
                    <Text style={styles.label}>Custom Category Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., GROCERY"
                      value={editedCategory}
                      onChangeText={(text) =>
                        setEditedCategory(text.replace(/,/g, "").toUpperCase())
                      }
                      accessibilityLabel="Custom Category Name"
                    />
                  </>
                )}

                {/* Display Calculated Cashback */}
                <Text style={styles.summaryText}>
                  Calculated Cashback: {settings.currency}
                  {editedCashback.toFixed(2)}
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setEditTransaction(null)}
                    accessibilityLabel="Cancel Edit"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleSaveEdit}
                    accessibilityLabel="Save Edit"
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 4,
  },
  list: {
    flex: 1,
  },
  dateHeader: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 8,
    marginTop: 12,
  },
  transactionList: {
    marginBottom: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollContent: {
    // Style for ScrollView content
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20, // Add some vertical padding
  },
  modal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    width: width * 0.9,
    alignSelf: "center",
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12, // Add some space above buttons
  },
  modalButton: {
    flex: 1,
    padding: 12,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: "#E0E0E0",
  },
  modalButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1A1A1A",
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
  label: {
    // Added label style for modal inputs
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#1A1A1A",
    marginBottom: 8,
  },
});

export default ShowReportScreen;
