import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  SafeAreaView,
  ScrollView,
  Animated,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useStore } from "../store/store";
import moment from "moment";
import { Card } from "../types/types";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // Added for notch handling

interface CashbackResult {
  cardId: string;
  cardName: string;
  cashback: number;
  remaining: number;
}

const BestFitCardScreen: React.FC = () => {
  const { cards, settings, transactions, merchants, categories } = useStore();
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [useCustomMerchant, setUseCustomMerchant] = useState(false);
  const [category, setCategory] = useState("");
  const [onlineOffline, setOnlineOffline] = useState<"Online" | "Offline">(
    "Online"
  );
  const [paymentType, setPaymentType] = useState<"Full Payment" | "EMI">(
    "Full Payment"
  );
  const [results, setResults] = useState<CashbackResult[]>([]);
  const [bestCard, setBestCard] = useState<CashbackResult | null>(null);

  // Animation setup using Animated
  const scale = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets(); // Get safe area insets for notch/status bar

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

  // Collect unique categories from cashback rules and store
  const availableCategories = Array.from(
    new Set([
      ...categories.map((cat) => cat.toUpperCase()),
      ...cards
        .flatMap((card: Card) =>
          card.cashbackRules.flatMap((rule) => rule.categories)
        )
        .filter((cat) => cat)
        .map((cat) => cat.toUpperCase()),
    ])
  );

  // Collect unique merchants from cashback rules and store
  const availableMerchants = Array.from(
    new Set([
      ...merchants.map((m) => m.toUpperCase()),
      ...cards
        .flatMap((card: Card) =>
          card.cashbackRules.map((rule) => rule.merchant).filter(Boolean)
        )
        .map((m) => m.toUpperCase()),
    ])
  );

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
    if (!amount || Number(amount) <= 0 || !merchant) {
      Alert.alert("Error", "Please fill all required fields.");
      return;
    }

    const today = moment().format("YYYY-MM-DD");
    const newResults: CashbackResult[] = cards.map((card: Card) => {
      let cashback = 0;
      let remaining = Infinity;
      const rule = card.cashbackRules.find(
        (r) =>
          (r.onlineOffline === onlineOffline || r.onlineOffline === "Both") &&
          r.paymentType === paymentType &&
          (!r.merchant ||
            r.merchant.toUpperCase() === merchant.toUpperCase()) &&
          (!category ||
            r.categories.length === 0 ||
            r.categories.includes(category.toUpperCase()))
      );

      if (rule) {
        const { start, end } = getBillingCycleDates(card, today);
        const earned = transactions
          .filter(
            (t) =>
              t.cardId === card.id &&
              moment(t.date, "YYYY-MM-DD").isBetween(
                start,
                end,
                undefined,
                "[]"
              ) &&
              (rule.onlineOffline === t.onlineOffline ||
                rule.onlineOffline === "Both") &&
              rule.paymentType === t.paymentType &&
              (!rule.merchant ||
                rule.merchant.toUpperCase() === t.merchant.toUpperCase()) &&
              (!category ||
                rule.categories.length === 0 ||
                rule.categories.includes(t.category.toUpperCase()))
          )
          .reduce((sum, t) => sum + (t.cashback || 0), 0);

        const ruleLimit = rule.limit || Infinity;
        remaining = Math.max(0, ruleLimit - earned);
        const potentialCashback = (Number(amount) * rule.percentage) / 100;
        cashback = Math.min(potentialCashback, remaining);
        remaining = Math.max(0, ruleLimit - (earned + cashback));
      }

      return {
        cardId: card.id,
        cardName: card.name.toUpperCase(),
        cashback,
        remaining,
      };
    });

    const validResults = newResults.filter((r) => r.cashback >= 0);
    if (validResults.length === 0) {
      Alert.alert("No Matching Cards", "No cards match the provided criteria.");
      setResults([]);
      setBestCard(null);
      return;
    }

    const best = validResults.reduce(
      (prev, curr) => (curr.cashback > prev.cashback ? curr : prev),
      validResults[0]
    );
    setResults(validResults);
    setBestCard(best);
  };

  const renderResult = ({ item }: { item: CashbackResult }) => (
    <View
      style={[
        styles.resultCard,
        item.cardId === bestCard?.cardId && styles.bestCard,
      ]}
    >
      <Text style={styles.resultText}>{item.cardName}</Text>
      <Text style={styles.resultText}>
        Cashback: {settings.currency}
        {item.cashback.toFixed(2)}
      </Text>
      <Text style={styles.resultText}>
        Remaining: {settings.currency}
        {item.remaining === Infinity ? "Unlimited" : item.remaining.toFixed(2)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeContainer, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <Text style={styles.header}>Best Fit Card</Text>
        <Text style={styles.instruction}>
          This section helps you choose the card that offers the maximum
          cashback for your transaction.
        </Text>
        <Text style={styles.warning}>
          Caution: Cashback calculations are based on the rules you set. They
          are not linked to merchant or card company offers. Always verify
          cashback details with the merchant and card issuer. The developer is
          not responsible for any financial loss.
        </Text>
        <Text style={styles.label}>Transaction Amount</Text>
        <TextInput
          style={styles.input}
          placeholder={`${settings.currency}0.00`}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          accessibilityLabel="Transaction Amount"
        />
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
            {availableMerchants.map((m) => (
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
              accessibilityLabel="Custom Merchant Name"
            />
            <Text style={styles.instruction}>
              Enter one merchant name without commas (e.g., AMAZON).
            </Text>
          </>
        )}
        <Text style={styles.label}>Category</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category || "NO_SPECIFIC"}
            onValueChange={(value) =>
              setCategory(value === "NO_SPECIFIC" ? "" : value.toUpperCase())
            }
            style={styles.picker}
          >
            <Picker.Item label="Select Category" value="" />
            {availableCategories.map((cat) => (
              <Picker.Item
                key={cat}
                label={cat.toUpperCase()}
                value={cat.toUpperCase()}
              />
            ))}
            <Picker.Item label="No Specific Category" value="NO_SPECIFIC" />
          </Picker>
        </View>
        <Text style={styles.label}>Transaction Type</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              onlineOffline === "Online" && styles.toggleActive,
            ]}
            onPress={() => setOnlineOffline("Online")}
            accessibilityLabel="Online Transaction"
            accessibilityRole="button"
          >
            <Text style={styles.toggleText}>Online</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              onlineOffline === "Offline" && styles.toggleActive,
            ]}
            onPress={() => setOnlineOffline("Offline")}
            accessibilityLabel="Offline Transaction"
            accessibilityRole="button"
          >
            <Text style={styles.toggleText}>Offline</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.label}>Payment Type</Text>
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              paymentType === "Full Payment" && styles.toggleActive,
            ]}
            onPress={() => setPaymentType("Full Payment")}
            accessibilityLabel="Full Payment"
            accessibilityRole="button"
          >
            <Text style={styles.toggleText}>Full Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              paymentType === "EMI" && styles.toggleActive,
            ]}
            onPress={() => setPaymentType("EMI")}
            accessibilityLabel="EMI Payment"
            accessibilityRole="button"
          >
            <Text style={styles.toggleText}>EMI</Text>
          </TouchableOpacity>
        </View>
        <Animated.View style={[styles.checkButton, { transform: [{ scale }] }]}>
          <TouchableOpacity
            onPress={calculateCashback}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Check Best Fit Card"
            accessibilityRole="button"
          >
            <Text style={styles.checkButtonText}>Check Best Fit Card</Text>
          </TouchableOpacity>
        </Animated.View>
        {bestCard && (
          <View style={styles.bestCardContainer}>
            <Text style={styles.bestCardText}>
              Best Card: {bestCard.cardName} ({settings.currency}
              {bestCard.cashback.toFixed(2)})
            </Text>
          </View>
        )}
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => item.cardId}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 48 }}
          scrollEnabled={false}
        />
        <View style={styles.bottomSpacer} />
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
  instruction: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#666666",
    marginBottom: 8,
  },
  warning: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#D32F2F",
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
  checkButton: {
    backgroundColor: "#FBC02D",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  checkButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  bestCardContainer: {
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bestCardText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#388E3C",
  },
  list: {
    marginBottom: 16,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  bestCard: {
    backgroundColor: "#E8F5E9",
  },
  resultText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 20,
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

export default BestFitCardScreen;
