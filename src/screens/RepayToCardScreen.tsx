import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Dimensions,
  Animated,
  SafeAreaView,
} from "react-native";
import { Picker } from "@react-native-picker/picker"; // Updated import
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useStore } from "../store/store";
import moment from "moment";
import * as Crypto from "expo-crypto";
import { Card, Repayment, Transaction } from "../types/types";

const { width } = Dimensions.get("window");

type RootStackParamList = {
  RepayToCard: undefined;
};
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RepayToCardScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { cards, repayments, settings, addRepayment, transactions } =
    useStore();
  const [cardId, setCardId] = useState("");
  const [billingCycle, setBillingCycle] = useState("current");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [editRepayment, setEditRepayment] = useState<null | {
    id: string;
    amount: string;
    description: string;
    billingCycleStart?: string;
  }>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  // Calculate unbilled amount for the selected billing cycle
  const getUnbilledAmount = (cardId: string, billingCycle: string) => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return 0;

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
        (r: Repayment) =>
          r.cardId === cardId &&
          r.billingCycleStart &&
          moment(r.billingCycleStart, "YYYY-MM-DD").isSame(start, "day")
      )
      .reduce((sum: number, r: Repayment) => sum + r.amount, 0);

    return totalSpent - totalRepaid;
  };

  // Get filtered repayments for the selected billing cycle
  const getFilteredRepayments = (cardId: string, billingCycle: string) => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return [];

    let start: moment.Moment;
    if (billingCycle === "current") {
      const currentCycle = getBillingCycleDates(
        card,
        moment().format("YYYY-MM-DD")
      );
      start = currentCycle.start;
    } else {
      const [startDate] = billingCycle.split("|");
      start = moment(startDate, "YYYY-MM-DD");
    }

    return repayments.filter(
      (r: Repayment) =>
        r.cardId === cardId &&
        r.billingCycleStart &&
        moment(r.billingCycleStart, "YYYY-MM-DD").isSame(start, "day")
    );
  };

  const handleSave = () => {
    if (!cardId) return Alert.alert("Error", "Please select a card.");
    if (!amount || Number(amount) <= 0)
      return Alert.alert("Error", "Please enter a valid amount.");

    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return Alert.alert("Error", "Invalid card selected.");

    let billingCycleStart: string;
    if (billingCycle === "current") {
      const currentCycle = getBillingCycleDates(
        card,
        moment().format("YYYY-MM-DD")
      );
      billingCycleStart = currentCycle.start.format("YYYY-MM-DD");
    } else {
      const [startDate] = billingCycle.split("|");
      billingCycleStart = startDate;
    }

    const repayment = {
      id: Crypto.randomUUID(),
      cardId,
      amount: Number(amount),
      date: moment().format("YYYY-MM-DD"),
      description: description || undefined,
      billingCycleStart,
    };
    addRepayment(repayment);
    setAmount("");
    setDescription("");
    Alert.alert("Success", "Repayment added successfully!");
  };

  const handleEdit = (repayment: Repayment) => {
    setEditRepayment({
      id: repayment.id,
      amount: repayment.amount.toString(),
      description: repayment.description || "",
      billingCycleStart: repayment.billingCycleStart,
    });
  };

  const handleSaveEdit = () => {
    if (!editRepayment) return;
    useStore.setState((state) => ({
      repayments: state.repayments.map((r: Repayment) =>
        r.id === editRepayment.id
          ? {
              ...r,
              amount: Number(editRepayment.amount),
              description: editRepayment.description,
              billingCycleStart: editRepayment.billingCycleStart,
            }
          : r
      ),
    }));
    setEditRepayment(null);
    Alert.alert("Success", "Repayment updated successfully!");
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      useStore.setState((state) => ({
        repayments: state.repayments.filter(
          (r: Repayment) => r.id !== deleteId
        ),
      }));
      setDeleteId(null);
      Alert.alert("Success", "Repayment deleted successfully!");
    }
  };

  const renderRepayment = ({ item }: { item: Repayment }) => (
    <View style={styles.repaymentCard}>
      <View>
        <Text style={styles.repaymentText}>
          Amount: {settings.currency}
          {item.amount}
        </Text>
        <Text style={styles.repaymentText}>Date: {item.date}</Text>
        {item.description && (
          <Text style={styles.repaymentText}>
            Description: {item.description}
          </Text>
        )}
        {item.billingCycleStart && (
          <Text style={styles.repaymentText}>
            Billing Cycle Start:{" "}
            {moment(item.billingCycleStart).format("DD MMM YYYY")}
          </Text>
        )}
      </View>
      <View style={styles.repaymentIcons}>
        <TouchableOpacity onPress={() => handleEdit(item)}>
          <Feather name="edit" size={24} color="#1976D2" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Feather name="trash-2" size={24} color="#D32F2F" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.container}>
        <Text style={styles.header}>Repay to Card</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={cardId}
            onValueChange={(value) => {
              setCardId(value);
              setBillingCycle("current");
            }}
            style={styles.picker}
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
            <Text style={styles.unbilled}>
              Total Unbilled Amount: {settings.currency}
              {getUnbilledAmount(cardId, billingCycle)}
            </Text>
          </>
        )}
        <TextInput
          style={styles.input}
          placeholder={`${settings.currency}0.00`}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          accessibilityLabel="Repayment Amount"
        />
        <TextInput
          style={styles.input}
          placeholder="Description (Optional)"
          value={description}
          onChangeText={setDescription}
          accessibilityLabel="Repayment Description"
        />
        <Animated.View style={[styles.saveButton, { transform: [{ scale }] }]}>
          <TouchableOpacity
            onPress={handleSave}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Save Repayment"
            accessibilityRole="button"
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.sectionTitle}>Repayment History</Text>
        <FlatList
          data={getFilteredRepayments(cardId, billingCycle)}
          renderItem={renderRepayment}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 48 }}
        />
        {/* Edit Repayment Modal */}
        <Modal
          visible={!!editRepayment}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditRepayment(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Edit Repayment</Text>
              <TextInput
                style={[styles.input, styles.modalInput]}
                placeholder={`${settings.currency}0.00`}
                keyboardType="numeric"
                value={editRepayment?.amount}
                onChangeText={(text) =>
                  setEditRepayment((prev) => prev && { ...prev, amount: text })
                }
                accessibilityLabel="Edit Repayment Amount"
              />
              <TextInput
                style={[styles.input, styles.modalInput]}
                placeholder="Description (Optional)"
                value={editRepayment?.description}
                onChangeText={(text) =>
                  setEditRepayment(
                    (prev) => prev && { ...prev, description: text }
                  )
                }
                accessibilityLabel="Edit Repayment Description"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setEditRepayment(null)}
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
        {/* Delete Confirmation Modal */}
        <Modal
          visible={!!deleteId}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setDeleteId(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>
                Are you sure you want to delete this repayment?
              </Text>
              <Text style={styles.warning}>This action cannot be undone.</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => setDeleteId(null)}
                  accessibilityLabel="Cancel Delete"
                  accessibilityRole="button"
                >
                  <Text style={styles.modalButtonText}>No</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={confirmDelete}
                  accessibilityLabel="Confirm Delete"
                  accessibilityRole="button"
                >
                  <Text style={[styles.modalButtonText, { color: "#D32F2F" }]}>
                    Yes
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
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
  modalInput: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  unbilled: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#388E3C",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  saveButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  repaymentCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: "relative",
  },
  repaymentText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 4,
  },
  repaymentIcons: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  warning: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#D32F2F",
    marginBottom: 16,
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

export default RepayToCardScreen;
