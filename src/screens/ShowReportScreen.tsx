import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
} from "react-native";
import { Picker } from "@react-native-picker/picker"; // Updated import
import { useStore } from "../store/store";
import { Transaction, Card } from "../types/types";
import moment from "moment";
import TransactionCard from "../components/TransactionCard";

const { width } = Dimensions.get("window");

const ShowReportScreen: React.FC = () => {
  const { cards, transactions, settings } = useStore();
  const [cardId, setCardId] = useState("");
  const [billingCycle, setBillingCycle] = useState("current");
  const [personFilter, setPersonFilter] = useState("");
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null
  );
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Compute billing cycle for a given date
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

    // Get current billing cycle (for today, May 20, 2025)
    const today = moment();
    const currentCycle = getBillingCycleDates(card, today.format("YYYY-MM-DD"));
    const currentLabel = `Current (${currentCycle.start.format(
      "DD MMM YYYY"
    )} - ${currentCycle.end.format("DD MMM YYYY")})`;

    // Get all billing cycles from transactions
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

    // Sort cycles (latest first) and map to dropdown options
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

    // Filter by person
    if (personFilter) {
      filtered = filtered.filter(
        (t: Transaction) =>
          t.personName === personFilter ||
          (!t.personName && personFilter === "Myself")
      );
    }

    // Filter by billing cycle
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

    // Group by date and sort (latest first)
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
  const getSummary = () => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) {
      return { totalSpent: 0, unbilled: 0, repaid: 0 };
    }

    // Determine billing cycle dates
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

    // Filter transactions by billing cycle
    const cardTransactions = transactions.filter(
      (t: Transaction) =>
        t.cardId === cardId &&
        moment(t.date, "YYYY-MM-DD").isBetween(start, end, undefined, "[]")
    );
    const totalSpent = cardTransactions.reduce(
      (sum: number, t: Transaction) => sum + t.amount,
      0
    );

    // Filter repayments by billing cycle
    const totalRepaid = useStore
      .getState()
      .repayments.filter(
        (r: { cardId: string; date?: string }) =>
          r.cardId === cardId &&
          r.date &&
          moment(r.date, "YYYY-MM-DD").isBetween(start, end, undefined, "[]")
      )
      .reduce((sum: number, r: { amount: number }) => sum + r.amount, 0);

    return {
      totalSpent,
      unbilled: totalSpent - totalRepaid,
      repaid: totalRepaid,
    };
  };

  // Handle edit
  const handleEdit = (transaction: Transaction) => {
    setEditTransaction(transaction);
  };

  // Save edited transaction
  const handleSaveEdit = () => {
    if (!editTransaction) return;
    useStore.setState((state: { transactions: Transaction[] }) => ({
      transactions: state.transactions.map((t) =>
        t.id === editTransaction.id ? editTransaction : t
      ),
    }));
    setEditTransaction(null);
    Alert.alert("Success", "Transaction updated successfully!");
  };

  // Handle delete with confirmation
  const handleDelete = (id: string) => {
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
          />
        )}
        keyExtractor={(t) => t.id}
        style={styles.transactionList}
      />
    </View>
  );

  const summary = cardId
    ? getSummary()
    : { totalSpent: 0, unbilled: 0, repaid: 0 };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Show Report</Text>
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
              {summary.totalSpent}
            </Text>
            <Text style={styles.summaryText}>
              Unbilled Amount: {settings.currency}
              {summary.unbilled}
            </Text>
            <Text style={styles.summaryText}>
              Repaid Amount: {settings.currency}
              {summary.repaid}
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
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Transaction</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount"
              keyboardType="numeric"
              value={editTransaction?.amount.toString()}
              onChangeText={(text) =>
                setEditTransaction(
                  (prev) => prev && { ...prev, amount: Number(text) }
                )
              }
              accessibilityLabel="Transaction Amount"
            />
            <TextInput
              style={styles.input}
              placeholder="Merchant"
              value={editTransaction?.merchant}
              onChangeText={(text) =>
                setEditTransaction(
                  (prev) => prev && { ...prev, merchant: text }
                )
              }
              accessibilityLabel="Transaction Merchant"
            />
            <TextInput
              style={styles.input}
              placeholder="Description"
              value={editTransaction?.description}
              onChangeText={(text) =>
                setEditTransaction(
                  (prev) => prev && { ...prev, description: text }
                )
              }
              accessibilityLabel="Transaction Description"
            />
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
        </View>
      </Modal>
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
    marginBottom: 8,
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
});

export default ShowReportScreen;
