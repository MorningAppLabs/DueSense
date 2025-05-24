import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  Modal,
  ScrollView, // Added for scrolling
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../store/store";
import moment from "moment";
import * as Crypto from "expo-crypto";
import { BackHandler } from "react-native";
import { Calendar } from "react-native-calendars";
import { Card, Transaction } from "../types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Define Tab Navigator routes
type TabParamList = {
  Home: undefined;
  ShowReport: undefined;
  MoneyOwed: undefined;
  YourCards: undefined;
  Settings: undefined;
};

// Define Stack Navigator routes
type RootStackParamList = {
  Main: { screen?: keyof TabParamList };
  AddSpending: undefined;
  RepayToCard: undefined;
  BestFitCard: undefined;
};

// Composite navigation prop
type NavigationProp = NativeStackNavigationProp<RootStackParamList> &
  BottomTabNavigationProp<TabParamList>;

const AddSpendingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    cards,
    settings,
    addTransaction,
    addMerchant,
    addCategory,
    addPerson,
    merchants,
    categories: storeCategories,
    persons,
  } = useStore();
  const [step, setStep] = useState(1);
  const [cardId, setCardId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState<"Full Payment" | "EMI">(
    "Full Payment"
  );
  const [emiAmount, setEmiAmount] = useState("");
  const [emiMonths, setEmiMonths] = useState("");
  const [interest, setInterest] = useState("");
  const [date, setDate] = useState<string>(moment().format("YYYY-MM-DD"));
  const [showCalendar, setShowCalendar] = useState(false);
  const [onlineOffline, setOnlineOffline] = useState<"Online" | "Offline">(
    "Online"
  );
  const [merchant, setMerchant] = useState("");
  const [useCustomMerchant, setUseCustomMerchant] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [forWhom, setForWhom] = useState<"Myself" | "Someone Else">("Myself");
  const [personName, setPersonName] = useState("");
  const [useCustomPerson, setUseCustomPerson] = useState(false);
  const [repaid, setRepaid] = useState(false);
  const insets = useSafeAreaInsets(); // For notch handling

  // Collect unique categories from cards' cashback rules and store
  const categories = Array.from(
    new Set([
      ...storeCategories.map((cat) => cat.toUpperCase()),
      ...cards
        .flatMap((card: Card) =>
          card.cashbackRules.flatMap((rule) => rule.categories)
        )
        .filter((cat) => cat)
        .map((cat) => cat.toUpperCase()),
    ])
  ).sort();

  // Get current billing cycle for a card
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

  const calculateCashback = () => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card || !card.cashbackRules.length) return 0;

    const rule = card.cashbackRules.find(
      (r) =>
        (r.onlineOffline === onlineOffline || r.onlineOffline === "Both") &&
        r.paymentType === paymentType &&
        (!r.merchant || r.merchant.toUpperCase() === merchant.toUpperCase()) &&
        (!r.categories.length || r.categories.includes(category.toUpperCase()))
    );

    if (!rule) return 0;

    const { start, end } = getBillingCycleDates(card, date);
    const earned = card.cashbackRules
      .filter(
        (r) =>
          r === rule &&
          (r.onlineOffline === onlineOffline || r.onlineOffline === "Both") &&
          r.paymentType === paymentType &&
          (!r.merchant ||
            r.merchant.toUpperCase() === merchant.toUpperCase()) &&
          (!r.categories.length ||
            r.categories.includes(category.toUpperCase()))
      )
      .reduce((sum, r) => {
        const transactions = useStore
          .getState()
          .transactions.filter(
            (t) =>
              t.cardId === card.id &&
              moment(t.date, "YYYY-MM-DD").isBetween(
                start,
                end,
                undefined,
                "[]"
              ) &&
              (r.onlineOffline === t.onlineOffline ||
                r.onlineOffline === "Both") &&
              r.paymentType === t.paymentType &&
              (!r.merchant ||
                r.merchant.toUpperCase() === t.merchant.toUpperCase()) &&
              (!r.categories.length ||
                r.categories.includes(t.category.toUpperCase()))
          );
        return sum + transactions.reduce((s, t) => s + (t.cashback || 0), 0);
      }, 0);

    const remaining = Math.max(0, (rule.limit || Infinity) - earned);
    const potentialCashback = (Number(amount) * rule.percentage) / 100;
    return Math.min(potentialCashback, remaining);
  };

  const calculateRemainingCashback = () => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card || !card.cashbackRules.length) return 0;

    const rule = card.cashbackRules.find(
      (r) =>
        (r.onlineOffline === onlineOffline || r.onlineOffline === "Both") &&
        r.paymentType === paymentType &&
        (!r.merchant || r.merchant.toUpperCase() === merchant.toUpperCase()) &&
        (!r.categories.length || r.categories.includes(category.toUpperCase()))
    );

    if (!rule) return 0;

    const { start, end } = getBillingCycleDates(card, date);
    const earned = card.cashbackRules
      .filter(
        (r) =>
          r === rule &&
          (r.onlineOffline === onlineOffline || r.onlineOffline === "Both") &&
          r.paymentType === paymentType &&
          (!r.merchant ||
            r.merchant.toUpperCase() === merchant.toUpperCase()) &&
          (!r.categories.length ||
            r.categories.includes(category.toUpperCase()))
      )
      .reduce((sum, r) => {
        const transactions = useStore
          .getState()
          .transactions.filter(
            (t) =>
              t.cardId === card.id &&
              moment(t.date, "YYYY-MM-DD").isBetween(
                start,
                end,
                undefined,
                "[]"
              ) &&
              (r.onlineOffline === t.onlineOffline ||
                r.onlineOffline === "Both") &&
              r.paymentType === t.paymentType &&
              (!r.merchant ||
                r.merchant.toUpperCase() === t.merchant.toUpperCase()) &&
              (!r.categories.length ||
                r.categories.includes(t.category.toUpperCase()))
          );
        return sum + transactions.reduce((s, t) => s + (t.cashback || 0), 0);
      }, 0);

    const currentCashback = calculateCashback();
    return Math.max(0, (rule.limit || Infinity) - (earned + currentCashback));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!cardId) return Alert.alert("Error", "Please select a card.");
      if (!amount || Number(amount) <= 0)
        return Alert.alert("Error", "Please enter a valid amount.");
      if (paymentType === "EMI") {
        if (
          !emiAmount ||
          !emiMonths ||
          Number(emiAmount) <= 0 ||
          Number(emiMonths) <= 0
        )
          return Alert.alert("Error", "Please enter valid EMI details.");
      }
      setStep(2);
    } else if (step === 2) {
      if (!merchant || !description || !category)
        return Alert.alert("Error", "Please fill all fields.");
      setStep(3);
    } else if (step === 3) {
      if (forWhom === "Someone Else" && !personName)
        return Alert.alert(
          "Error",
          "Please enter or select the person's name."
        );
      const transaction: Transaction = {
        id: Crypto.randomUUID(),
        cardId,
        amount: Number(amount),
        paymentType,
        emiPlan:
          paymentType === "EMI"
            ? {
                amount: Number(emiAmount),
                months: Number(emiMonths),
                interest: Number(interest) || 0,
              }
            : undefined,
        date,
        onlineOffline,
        merchant: merchant.toUpperCase(),
        description: description.toUpperCase(),
        category: category.toUpperCase(),
        cashback: calculateCashback(),
        forWhom,
        personName: forWhom === "Someone Else" ? personName : undefined,
        repaid: forWhom === "Myself" || repaid,
      };
      addTransaction(transaction);
      if (merchant && useCustomMerchant) addMerchant(merchant.toUpperCase());
      if (category && useCustomCategory) addCategory(category.toUpperCase());
      if (personName && useCustomPerson) addPerson(personName);
      navigation.goBack();
    }
  };

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (step > 1) {
              setStep(step - 1);
            } else {
              navigation.goBack();
            }
          }}
          style={{ marginLeft: 16 }}
        >
          <Feather name="arrow-left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      ),
    });

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (step > 1) {
          setStep(step - 1);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [navigation, step]);

  if (!cards.length) {
    Alert.alert("No Cards", "Please add a credit card in Your Cards section.", [
      {
        text: "OK",
        onPress: () => navigation.navigate("Main", { screen: "YourCards" }),
      },
    ]);
    return null;
  }

  return (
    <SafeAreaView style={[styles.safeContainer, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 48 }} // Added padding for bottom spacing
        keyboardShouldPersistTaps="handled" // Ensures taps work even with keyboard open
      >
        {step === 1 && (
          <>
            <Text style={styles.header}>Add Spending</Text>
            <Text style={styles.label}>Select Credit Card</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={cardId}
                onValueChange={(value) => setCardId(value)}
                style={styles.picker}
              >
                <Picker.Item label="Select Credit Card" value="" />
                {cards.map((card: Card) => (
                  <Picker.Item
                    key={card.id}
                    label={card.name.toUpperCase()}
                    value={card.id}
                  />
                ))}
              </Picker>
            </View>
            <Text style={styles.label}>Transaction Amount</Text>
            <TextInput
              style={styles.input}
              placeholder={`${settings.currency}0.00`}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            <Text style={styles.label}>Transaction Date</Text>
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowCalendar(true)}
            >
              <Text style={styles.dateText}>
                {moment(date).format("DD/MM/YYYY")}
              </Text>
              <Feather name="calendar" size={20} color="#1A1A1A" />
            </TouchableOpacity>
            <Modal
              visible={showCalendar}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setShowCalendar(false)}
            >
              <View style={styles.modalContainer}>
                <View style={styles.calendarContainer}>
                  <Calendar
                    current={date}
                    onDayPress={(day) => {
                      setDate(day.dateString);
                      setShowCalendar(false);
                    }}
                    markedDates={{
                      [date]: { selected: true, selectedColor: "#1976D2" },
                    }}
                    style={styles.calendar}
                  />
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowCalendar(false)}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            <Text style={styles.label}>Payment Type</Text>
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  paymentType === "Full Payment" && styles.toggleActive,
                ]}
                onPress={() => setPaymentType("Full Payment")}
              >
                <Text style={styles.toggleText}>Full Payment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  paymentType === "EMI" && styles.toggleActive,
                ]}
                onPress={() => setPaymentType("EMI")}
              >
                <Text style={styles.toggleText}>EMI</Text>
              </TouchableOpacity>
            </View>
            {paymentType === "EMI" && (
              <>
                <Text style={styles.label}>EMI Amount</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`${settings.currency}0.00`}
                  keyboardType="numeric"
                  value={emiAmount}
                  onChangeText={setEmiAmount}
                />
                <Text style={styles.label}>EMI Months</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 6"
                  keyboardType="numeric"
                  value={emiMonths}
                  onChangeText={setEmiMonths}
                />
                <Text style={styles.label}>Interest Amount (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`${settings.currency}0.00`}
                  keyboardType="numeric"
                  value={interest}
                  onChangeText={setInterest}
                />
                <Text style={styles.instruction}>
                  For EMI, enter the monthly amount and duration. The
                  transaction will be auto-added each month until the EMI
                  completes. Do not add EMI manually each month.
                </Text>
                <Text style={styles.warning}>
                  Interest amount is a fixed value, not a percentage.
                </Text>
              </>
            )}
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.header}>Transaction Details</Text>
            <Text style={styles.label}>Transaction Type</Text>
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  onlineOffline === "Online" && styles.toggleActive,
                ]}
                onPress={() => setOnlineOffline("Online")}
              >
                <Text style={styles.toggleText}>Online</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  onlineOffline === "Offline" && styles.toggleActive,
                ]}
                onPress={() => setOnlineOffline("Offline")}
              >
                <Text style={styles.toggleText}>Offline</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Merchant Name</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={useCustomMerchant ? "Other" : merchant}
                onValueChange={(value) => {
                  setMerchant(value === "Other" ? "" : value.toUpperCase());
                  setUseCustomMerchant(value === "Other");
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select Merchant" value="" />
                {merchants.map((m) => (
                  <Picker.Item
                    key={m}
                    label={m.toUpperCase()}
                    value={m.toUpperCase()}
                  />
                ))}
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
            {useCustomMerchant && (
              <>
                <Text style={styles.label}>Custom Merchant Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., AMAZON"
                  value={merchant}
                  onChangeText={(text) =>
                    setMerchant(text.replace(/,/g, "").toUpperCase())
                  }
                />
                <Text style={styles.instruction}>
                  Enter one merchant name without commas (e.g., AMAZON).
                </Text>
              </>
            )}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., GROCERY SHOPPING"
              value={description}
              onChangeText={(text) => setDescription(text.toUpperCase())}
            />
            <Text style={styles.label}>Category</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={useCustomCategory ? "Other" : category}
                onValueChange={(value) => {
                  setCategory(value === "Other" ? "" : value.toUpperCase());
                  setUseCustomCategory(value === "Other");
                }}
                style={styles.picker}
              >
                <Picker.Item label="Select Category" value="" />
                {categories.map((cat) => (
                  <Picker.Item
                    key={cat}
                    label={cat.toUpperCase()}
                    value={cat.toUpperCase()}
                  />
                ))}
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>
            {useCustomCategory && (
              <>
                <Text style={styles.label}>Custom Category Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., GROCERY"
                  value={category}
                  onChangeText={(text) =>
                    setCategory(text.replace(/,/g, "").toUpperCase())
                  }
                />
                <Text style={styles.instruction}>
                  Enter one category name without commas (e.g., GROCERY).
                </Text>
              </>
            )}
            {calculateCashback() > 0 ? (
              <>
                <Text style={styles.cashback}>
                  Cashback for this transaction: {settings.currency}
                  {calculateCashback().toFixed(2)}
                </Text>
                <Text style={styles.cashback}>
                  Remaining cashback: {settings.currency}
                  {calculateRemainingCashback().toFixed(2)}
                </Text>
              </>
            ) : (
              <Text style={styles.warning}>
                No cashback applicable for this category or merchant. Select a
                different category or merchant to check cashback eligibility.
              </Text>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.header}>For Whom</Text>
            <Text style={styles.label}>
              Who made this purchase using your card?
            </Text>
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  forWhom === "Myself" && styles.toggleActive,
                ]}
                onPress={() => setForWhom("Myself")}
              >
                <Text style={styles.toggleText}>Myself</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  forWhom === "Someone Else" && styles.toggleActive,
                ]}
                onPress={() => setForWhom("Someone Else")}
              >
                <Text style={styles.toggleText}>Someone Else</Text>
              </TouchableOpacity>
            </View>
            {forWhom === "Someone Else" && (
              <>
                <Text style={styles.label}>Person’s Name</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={useCustomPerson ? "Other" : personName}
                    onValueChange={(value) => {
                      setPersonName(value === "Other" ? "" : value);
                      setUseCustomPerson(value === "Other");
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select Person" value="" />
                    {persons.map((p: string) => (
                      <Picker.Item key={p} label={p} value={p} />
                    ))}
                    <Picker.Item label="Other" value="Other" />
                  </Picker>
                </View>
                {useCustomPerson && (
                  <>
                    <Text style={styles.label}>Enter New Person’s Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter person’s name"
                      value={personName}
                      onChangeText={setPersonName}
                    />
                  </>
                )}
                <Text style={styles.label}>Has this person repaid you?</Text>
                <View style={styles.toggle}>
                  <TouchableOpacity
                    style={[styles.toggleButton, repaid && styles.toggleActive]}
                    onPress={() => setRepaid(true)}
                  >
                    <Text style={styles.toggleText}>Repaid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      !repaid && styles.toggleActive,
                    ]}
                    onPress={() => setRepaid(false)}
                  >
                    <Text style={styles.toggleText}>Not Repaid</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        )}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {step === 3 ? "Save" : "Next"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  label: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#1A1A1A",
    marginBottom: 8,
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
  dateInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  dateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 16,
    width: "90%",
  },
  calendar: {
    borderRadius: 8,
  },
  closeButton: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  toggle: {
    flexDirection: "row",
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    padding: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  toggleActive: {
    backgroundColor: "#1976D2",
  },
  toggleText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  instruction: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  warning: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#D32F2F",
    marginBottom: 12,
  },
  cashback: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#388E3C",
    marginBottom: 8,
  },
  nextButton: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  nextButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
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

export default AddSpendingScreen;
