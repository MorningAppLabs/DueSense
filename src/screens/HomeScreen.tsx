import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { useStore } from "../store/store";
import ActionButton from "../components/ActionButton";
import ProgressBar from "../components/ProgressBar";
import { useNavigation } from "@react-navigation/native";
import { Transaction, Card, Repayment } from "../types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import moment from "moment";

type RootStackParamList = {
  Main: undefined;
  AddSpending: undefined;
  RepayToCard: undefined;
  BestFitCard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { cards, transactions, repayments, settings } = useStore();

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

    // Debug log
    console.log(
      `Billing Cycle for ${
        card.name
      } on ${transactionDate}: ${cycleStart.format(
        "YYYY-MM-DD"
      )} to ${cycleEnd.format("YYYY-MM-DD")}`
    );

    return { start: cycleStart, end: cycleEnd };
  };

  const getUnbilledAmount = (cardId: string) => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return 0;

    const today = moment();
    const { start, end } = getBillingCycleDates(
      card,
      today.format("YYYY-MM-DD")
    );

    const cardTransactions = transactions.filter((t: Transaction) => {
      const isMatch =
        t.cardId === cardId &&
        moment(t.date, "YYYY-MM-DD").isBetween(start, end, undefined, "[]");
      // Debug log
      if (isMatch) {
        console.log(
          `Transaction matched for ${card.name}: ${t.date}, Amount: ${t.amount}`
        );
      }
      return isMatch;
    });

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
      .reduce((sum: number, r: Repayment) => {
        // Debug log
        console.log(
          `Repayment matched for ${card.name}: ${r.billingCycleStart}, Amount: ${r.amount}`
        );
        return sum + r.amount;
      }, 0);

    // Debug log
    console.log(
      `${
        card.name
      } - Total Spent: ${totalSpent}, Total Repaid: ${totalRepaid}, Unbilled: ${
        totalSpent - totalRepaid
      }`
    );

    return totalSpent - totalRepaid;
  };

  const getCashbackEarned = (cardId: string) => {
    const card = cards.find((c: Card) => c.id === cardId);
    if (!card) return 0;

    const today = moment();
    const { start, end } = getBillingCycleDates(
      card,
      today.format("YYYY-MM-DD")
    );

    const cashback = transactions
      .filter(
        (t: Transaction) =>
          t.cardId === cardId &&
          moment(t.date, "YYYY-MM-DD").isBetween(start, end, undefined, "[]")
      )
      .reduce((sum: number, t: Transaction) => {
        const cb = t.cashback || 0;
        // Debug log
        if (cb > 0) {
          console.log(`Cashback for ${card.name}: ${t.date}, Amount: ${cb}`);
        }
        return sum + cb;
      }, 0);

    // Debug log
    console.log(`${card.name} - Total Cashback: ${cashback}`);

    return cashback;
  };

  const getOwedByPerson = () => {
    const owedTransactions = transactions.filter(
      (t: Transaction) => t.forWhom === "Someone Else" && !t.repaid
    );
    const grouped = owedTransactions.reduce((acc, t) => {
      const name = t.personName || "Unknown";
      acc[name] = (acc[name] || 0) + t.amount;
      // Debug log
      console.log(`Owed by ${name}: ${t.amount}`);
      return acc;
    }, {} as { [key: string]: number });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.header}>DueSense</Text>
        <View style={styles.actions}>
          <ActionButton
            label="Add Spending"
            icon="plus-circle"
            color="#1976D2"
            onPress={() => navigation.navigate("AddSpending")}
            accessibilityLabel="Add Spending"
            accessibilityRole="button"
          />
          <ActionButton
            label="Repay to Card"
            icon="credit-card"
            color="#388E3C"
            onPress={() => navigation.navigate("RepayToCard")}
            accessibilityLabel="Repay to Card"
            accessibilityRole="button"
          />
          <ActionButton
            label="Best Fit Card"
            icon="star"
            color="#FBC02D"
            onPress={() => navigation.navigate("BestFitCard")}
            accessibilityLabel="Best Fit Card"
            accessibilityRole="button"
          />
        </View>
        <View style={styles.overview}>
          <Text style={styles.sectionTitle}>
            Transaction & Cashback (Current Billing Cycle)
          </Text>
          {cards.length === 0 ? (
            <Text style={styles.noData}>No cards added yet.</Text>
          ) : (
            cards.map((card: Card) => (
              <View key={card.id} style={styles.card}>
                <Text style={styles.cardName}>{card.name}</Text>
                <Text style={styles.cardDetail}>
                  Total Transaction: {settings.currency}
                  {transactions
                    .filter(
                      (t: Transaction) =>
                        t.cardId === card.id &&
                        moment(t.date, "YYYY-MM-DD").isBetween(
                          getBillingCycleDates(
                            card,
                            moment().format("YYYY-MM-DD")
                          ).start,
                          getBillingCycleDates(
                            card,
                            moment().format("YYYY-MM-DD")
                          ).end,
                          undefined,
                          "[]"
                        )
                    )
                    .reduce((sum: number, t: Transaction) => sum + t.amount, 0)
                    .toFixed(2)}
                </Text>
                <Text style={styles.cardDetail}>
                  Credit Limit Left: {settings.currency}
                  {(card.limit - getUnbilledAmount(card.id)).toFixed(2)}
                </Text>
                <Text style={styles.cardDetail}>
                  Unbilled Amount: {settings.currency}
                  {getUnbilledAmount(card.id).toFixed(2)}
                </Text>
                <Text style={styles.cardDetail}>
                  Cashback Earned: {settings.currency}
                  {getCashbackEarned(card.id).toFixed(2)}
                </Text>
                <ProgressBar
                  label="Transaction"
                  filled={getUnbilledAmount(card.id)}
                  total={card.limit}
                  color="#1976D2"
                />
                <ProgressBar
                  label="Cashback"
                  filled={getCashbackEarned(card.id)}
                  total={card.cashbackRules.reduce(
                    (sum, r) => sum + (r.limit || Infinity),
                    0
                  )}
                  color="#388E3C"
                />
              </View>
            ))
          )}
          <Text style={styles.sectionTitle}>
            Money Owed (Current + Past Billing Cycles)
          </Text>
          {getOwedByPerson().length === 0 ? (
            <Text style={styles.noData}>No money owed.</Text>
          ) : (
            getOwedByPerson().map(([name, amount]) => (
              <View key={name} style={styles.owed}>
                <Text style={styles.owedName}>{name}</Text>
                <Text style={styles.owedAmount}>
                  {settings.currency}
                  {amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
    gap: 4,
  },
  overview: {
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 8,
  },
  cardDetail: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 4,
  },
  owed: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  owedName: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1A1A1A",
  },
  owedAmount: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#D32F2F",
  },
  noData: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#4A4A4A",
    textAlign: "center",
    marginBottom: 12,
  },
});

export default HomeScreen;
