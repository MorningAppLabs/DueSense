import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Switch,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { Picker } from "@react-native-picker/picker"; // Updated import
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import { Card, CashbackRule } from "../types/types";
import * as Crypto from "expo-crypto";

interface CashbackRuleInput {
  onlineOffline: "Online" | "Offline" | "Both";
  paymentType: "Full Payment" | "EMI";
  merchant: string;
  percentage: string;
  limit: string;
  categories: string[];
}

const YourCardsScreen: React.FC = () => {
  const {
    cards,
    settings,
    addCard,
    updateCard,
    addMerchant,
    addCategory,
    merchants,
    categories,
  } = useStore();
  const [name, setName] = useState("");
  const [startDay, setStartDay] = useState("");
  const [endDay, setEndDay] = useState("");
  const [limit, setLimit] = useState("");
  const [enableCashback, setEnableCashback] = useState(false);
  const [cashbackRules, setCashbackRules] = useState<CashbackRuleInput[]>([]);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [newRule, setNewRule] = useState<CashbackRuleInput>({
    onlineOffline: "Both",
    paymentType: "Full Payment",
    merchant: "",
    percentage: "",
    limit: "",
    categories: [],
  });
  const [newCategory, setNewCategory] = useState("");

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

  // Get unique merchants from store and cards
  const uniqueMerchants = Array.from(
    new Set([
      ...merchants.map((m) => m.toUpperCase()),
      ...cards
        .flatMap((card) => card.cashbackRules.map((r) => r.merchant))
        .filter((m) => m)
        .map((m) => m.toUpperCase()),
    ])
  ).sort();

  // Get unique categories from cards and store
  const uniqueCategories = Array.from(
    new Set([
      ...categories.map((c) => c.toUpperCase()),
      ...cards
        .flatMap((card) => card.cashbackRules.flatMap((r) => r.categories))
        .filter((c) => c)
        .map((c) => c.toUpperCase()),
    ])
  ).sort();

  // Update a cashback rule field
  const handleRuleChange = (field: keyof CashbackRuleInput, value: any) => {
    if (field === "merchant") {
      value = value.replace(/,/g, "").toUpperCase();
    }
    setNewRule((prev) => ({ ...prev, [field]: value }));
  };

  // Add a category to the new rule
  const handleAddCategory = () => {
    if (!newCategory.trim()) {
      Alert.alert("Error", "Please enter a category name.");
      return;
    }
    const category = newCategory.trim().replace(/,/g, "").toUpperCase();
    addCategory(category);
    setNewRule((prev) => ({
      ...prev,
      categories: [...prev.categories, category],
    }));
    setNewCategory("");
  };

  // Remove a category from the new rule
  const handleRemoveCategory = (category: string) => {
    setNewRule((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== category),
    }));
  };

  // Save a cashback rule
  const handleSaveRule = () => {
    if (!newRule.percentage || Number(newRule.percentage) <= 0) {
      Alert.alert("Error", "Please enter a valid cashback percentage.");
      return;
    }
    setCashbackRules([...cashbackRules, { ...newRule }]);
    setNewRule({
      onlineOffline: "Both",
      paymentType: "Full Payment",
      merchant: "",
      percentage: "",
      limit: "",
      categories: [],
    });
    setNewCategory("");
    Alert.alert("Success", "Cashback rule saved!");
  };

  // Delete a cashback rule
  const handleDeleteRule = (index: number) => {
    setCashbackRules((prev) => prev.filter((_, i) => i !== index));
  };

  // Save a new card
  const handleSave = () => {
    if (!name || !startDay || !endDay || !limit) {
      return Alert.alert("Error", "Please fill all required fields.");
    }

    const startDayNum = Number(startDay);
    const endDayNum = Number(endDay);
    const limitNum = Number(limit);

    if (
      startDayNum < 1 ||
      startDayNum > 31 ||
      endDayNum < 1 ||
      endDayNum > 31
    ) {
      return Alert.alert(
        "Error",
        "Billing cycle days must be between 1 and 31."
      );
    }

    // Corrected logic:
    if (startDayNum <= endDayNum) {
      // This is a same-month cycle or an invalid cross-month cycle
      // It's valid only if endDay is >= startDay AND they are not the same day
      if (startDayNum === endDayNum) {
        return Alert.alert(
          "Error",
          "Billing cycle start and end days cannot be the same unless it is for a full month, which is not implemented."
        );
      }
      // Valid same-month cycle (e.g., 5-25) - No error needed here
    } else {
      // This is a potential cross-month cycle (endDay < startDay)
      // It's valid only if endDay is exactly one day less than startDay
      const previousDay = startDayNum === 1 ? 31 : startDayNum - 1;
      if (endDayNum !== previousDay) {
        return Alert.alert(
          "Error",
          "For billing cycles that cross months, the end day must be exactly one day before the start day."
        );
      }
    }

    if (limitNum <= 0) {
      return Alert.alert("Error", "Credit limit must be greater than 0.");
    }

    if (
      enableCashback &&
      cashbackRules.some((r) => !r.percentage || Number(r.percentage) <= 0)
    ) {
      return Alert.alert("Error", "Please fill valid cashback percentages.");
    }

    const card: Card = {
      id: Crypto.randomUUID(),
      name: name.toUpperCase(),
      billingCycle: { start: Number(startDay), end: Number(endDay) },
      limit: Number(limit),
      cashbackRules: enableCashback
        ? cashbackRules.map(
            (r): CashbackRule => ({
              onlineOffline: r.onlineOffline,
              paymentType: r.paymentType,
              merchant: r.merchant || "",
              percentage: Number(r.percentage),
              limit: r.limit ? Number(r.limit) : undefined,
              categories: r.categories.map((c) => c.toUpperCase()),
            })
          )
        : [],
    };
    addCard(card);
    cashbackRules.forEach((r) => r.merchant && addMerchant(r.merchant));
    resetForm();
    Alert.alert("Success", "Card added successfully!");
  };

  // Reset form fields
  const resetForm = () => {
    setName("");
    setStartDay("");
    setEndDay("");
    setLimit("");
    setEnableCashback(false);
    setCashbackRules([]);
    setEditCard(null);
    setNewRule({
      onlineOffline: "Both",
      paymentType: "Full Payment",
      merchant: "",
      percentage: "",
      limit: "",
      categories: [],
    });
    setNewCategory("");
  };

  // Edit an existing card
  const handleEdit = (card: Card) => {
    setEditCard(card);
    setName(card.name.toUpperCase());
    setStartDay(card.billingCycle.start.toString());
    setEndDay(card.billingCycle.end.toString());
    setLimit(card.limit.toString());
    setEnableCashback(!!card.cashbackRules.length);
    setCashbackRules(
      card.cashbackRules.map((r) => ({
        onlineOffline: r.onlineOffline,
        paymentType: r.paymentType,
        merchant: r.merchant.toUpperCase(),
        percentage: r.percentage.toString(),
        limit: r.limit ? r.limit.toString() : "",
        categories: r.categories.map((c) => c.toUpperCase()),
      }))
    );
  };

  // Delete a card with warning
  const handleDeleteCard = (cardId: string) => {
    const card = cards.find((c: Card) => c.id === cardId);
    const cardTransactionCount = useStore
      .getState()
      .transactions.filter((t) => t.cardId === cardId).length;

    const message =
      cardTransactionCount > 0
        ? `This card has ${cardTransactionCount} transaction(s). Deleting this card will orphan those transactions. Are you sure you want to delete this card?`
        : "Are you sure you want to delete this card?";

    Alert.alert("Delete Card", message, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          useStore.getState().deleteCard(cardId);
          Alert.alert("Success", "Card deleted successfully!");
        },
      },
    ]);
  };

  // Save edited card
  const handleSaveEdit = () => {
    if (!editCard) return;
    if (!name || !startDay || !endDay || !limit) {
      return Alert.alert("Error", "Please fill all required fields.");
    }

    const startDayNum = Number(startDay);
    const endDayNum = Number(endDay);
    const limitNum = Number(limit);

    if (
      startDayNum < 1 ||
      startDayNum > 31 ||
      endDayNum < 1 ||
      endDayNum > 31
    ) {
      return Alert.alert(
        "Error",
        "Billing cycle days must be between 1 and 31."
      );
    }

    // Corrected logic (matching handleSave):
    if (startDayNum <= endDayNum) {
      // This is a same-month cycle or an invalid cross-month cycle
      // It's valid only if endDay is >= startDay AND they are not the same day
      if (startDayNum === endDayNum) {
        return Alert.alert(
          "Error",
          "Billing cycle start and end days cannot be the same unless it is for a full month, which is not implemented."
        );
      }
      // Valid same-month cycle (e.g., 5-25) - No error needed here
    } else {
      // This is a potential cross-month cycle (endDay < startDay)
      // It's valid only if endDay is exactly one day less than startDay
      const previousDay = startDayNum === 1 ? 31 : startDayNum - 1;
      if (endDayNum !== previousDay) {
        return Alert.alert(
          "Error",
          "For billing cycles that cross months, the end day must be exactly one day before the start day."
        );
      }
    }

    if (limitNum <= 0) {
      return Alert.alert("Error", "Credit limit must be greater than 0.");
    }
    if (
      enableCashback &&
      cashbackRules.some((r) => !r.percentage || Number(r.percentage) <= 0)
    ) {
      return Alert.alert("Error", "Please fill valid cashback percentages.");
    }

    const updatedCard: Card = {
      ...editCard,
      name: name.toUpperCase(),
      billingCycle: { start: Number(startDay), end: Number(endDay) },
      limit: Number(limit),
      cashbackRules: enableCashback
        ? cashbackRules.map(
            (r): CashbackRule => ({
              onlineOffline: r.onlineOffline,
              paymentType: r.paymentType,
              merchant: r.merchant || "",
              percentage: Number(r.percentage),
              limit: r.limit ? Number(r.limit) : undefined,
              categories: r.categories.map((c) => c.toUpperCase()),
            })
          )
        : [],
    };
    updateCard(updatedCard);
    cashbackRules.forEach((r) => r.merchant && addMerchant(r.merchant));
    resetForm();
    Alert.alert("Success", "Card updated successfully!");
  };

  // Render each card in the list
  const renderCard = ({ item }: { item: Card }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.cardText}>Name: {item.name.toUpperCase()}</Text>
        <Text style={styles.cardText}>
          Billing Cycle: Day {item.billingCycle.start} - Day{" "}
          {item.billingCycle.end}
        </Text>
        <Text style={styles.cardText}>
          Limit: {settings.currency}
          {item.limit.toFixed(2)}
        </Text>
        {item.cashbackRules.map((r, i) => (
          <Text key={i} style={styles.cardText}>
            Cashback Rule {i + 1}: {r.percentage}% on{" "}
            {r.categories.map((c) => c.toUpperCase()).join(", ") ||
              "All Categories"}{" "}
            ({r.merchant.toUpperCase() || "All Merchants"}, {r.onlineOffline},{" "}
            {r.paymentType})
            {r.limit
              ? ` up to ${settings.currency}${r.limit.toFixed(2)}`
              : " (No Limit)"}
          </Text>
        ))}
      </View>
      <View style={styles.cardIcons}>
        <TouchableOpacity
          onPress={() => handleEdit(item)}
          accessibilityLabel="Edit Card"
          accessibilityRole="button"
        >
          <Feather name="edit" size={24} color="#1976D2" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteCard(item.id)}
          accessibilityLabel="Delete Card"
          accessibilityRole="button"
        >
          <Feather name="trash-2" size={24} color="#D32F2F" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render categories for the new rule
  const renderCategory = ({ item }: { item: string }) => (
    <View style={styles.categoryTag}>
      <Text style={styles.categoryText}>{item}</Text>
      <TouchableOpacity
        onPress={() => handleRemoveCategory(item)}
        accessibilityLabel={`Remove ${item} Category`}
        accessibilityRole="button"
      >
        <Feather name="x" size={16} color="#D32F2F" />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Add or Edit Card</Text>
      <Text style={styles.label}>Card Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g., VISA PLATINUM"
        value={name}
        onChangeText={(text) => setName(text.toUpperCase())}
        accessibilityLabel="Card Name"
      />
      <View style={styles.billingCycle}>
        <View style={styles.billingCycleInput}>
          <Text style={styles.label}>Billing Cycle Start Day</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={startDay}
              onValueChange={(value) => setStartDay(value)}
              style={styles.picker}
              accessibilityLabel="Billing Cycle Start Day"
              accessibilityRole="combobox"
            >
              <Picker.Item label="Start Day" value="" />
              {Array.from({ length: 31 }, (_, i) => (
                <Picker.Item
                  key={i + 1}
                  label={`Day ${i + 1}`}
                  value={`${i + 1}`}
                />
              ))}
            </Picker>
          </View>
        </View>
        <View style={styles.billingCycleInput}>
          <Text style={styles.label}>Billing Cycle End Day</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={endDay}
              onValueChange={(value) => setEndDay(value)}
              style={styles.picker}
              accessibilityLabel="Billing Cycle End Day"
              accessibilityRole="combobox"
            >
              <Picker.Item label="End Day" value="" />
              {Array.from({ length: 31 }, (_, i) => (
                <Picker.Item
                  key={i + 1}
                  label={`Day ${i + 1}`}
                  value={`${i + 1}`}
                />
              ))}
            </Picker>
          </View>
        </View>
      </View>
      <Text style={styles.label}>Credit Limit</Text>
      <TextInput
        style={styles.input}
        placeholder={`${settings.currency}0.00`}
        keyboardType="numeric"
        value={limit}
        onChangeText={setLimit}
        accessibilityLabel="Credit Limit"
      />
      <View style={styles.toggle}>
        <Text style={styles.toggleLabel}>Track Cashback Rewards</Text>
        <Switch
          value={enableCashback}
          onValueChange={setEnableCashback}
          trackColor={{ false: "#E0E0E0", true: "#1976D2" }}
          thumbColor={enableCashback ? "#FFFFFF" : "#F5F5F5"}
          accessibilityLabel="Track Cashback Rewards"
        />
      </View>
      {enableCashback && (
        <>
          <Text style={styles.sectionTitle}>Cashback Rules</Text>
          <View style={styles.ruleContainer}>
            <Text style={styles.label}>Transaction Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newRule.onlineOffline}
                onValueChange={(value) =>
                  handleRuleChange("onlineOffline", value)
                }
                style={styles.picker}
                accessibilityLabel="Transaction Type"
                accessibilityRole="combobox"
              >
                <Picker.Item label="Online" value="Online" />
                <Picker.Item label="Offline" value="Offline" />
                <Picker.Item label="Both" value="Both" />
              </Picker>
            </View>
            <Text style={styles.label}>Payment Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newRule.paymentType}
                onValueChange={(value) =>
                  handleRuleChange("paymentType", value)
                }
                style={styles.picker}
                accessibilityLabel="Payment Type"
                accessibilityRole="combobox"
              >
                <Picker.Item label="Full Payment" value="Full Payment" />
                <Picker.Item label="EMI" value="EMI" />
              </Picker>
            </View>
            <Text style={styles.label}>Merchant (Optional)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={newRule.merchant || ""}
                onValueChange={(value) => handleRuleChange("merchant", value)}
                style={styles.picker}
                accessibilityLabel="Select Merchant"
                accessibilityRole="combobox"
              >
                <Picker.Item label="Select Merchant or Enter New" value="" />
                {uniqueMerchants.map((m) => (
                  <Picker.Item key={m} label={m} value={m} />
                ))}
                <Picker.Item label="Other" value="" />
              </Picker>
            </View>
            <TextInput
              style={styles.input}
              placeholder="e.g., AMAZON (leave blank for all)"
              value={newRule.merchant}
              onChangeText={(text) => handleRuleChange("merchant", text)}
              accessibilityLabel="Merchant Name"
            />
            <Text style={styles.instruction}>
              Enter one merchant name (e.g., AMAZON). Multiple merchants are not
              supported.
            </Text>
            <Text style={styles.label}>Cashback Percentage (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5"
              keyboardType="numeric"
              value={newRule.percentage}
              onChangeText={(text) => handleRuleChange("percentage", text)}
              accessibilityLabel="Cashback Percentage"
            />
            <Text style={styles.label}>Cashback Limit (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder={`${settings.currency}0.00 (leave blank for no limit)`}
              keyboardType="numeric"
              value={newRule.limit}
              onChangeText={(text) => handleRuleChange("limit", text)}
              accessibilityLabel="Cashback Limit"
            />
            <Text style={styles.label}>Categories (Optional)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue=""
                onValueChange={(value) => {
                  if (value && !newRule.categories.includes(value)) {
                    setNewRule((prev) => ({
                      ...prev,
                      categories: [...prev.categories, value],
                    }));
                  }
                }}
                style={styles.picker}
                accessibilityLabel="Select Existing Category"
                accessibilityRole="combobox"
              >
                <Picker.Item label="Select Existing Category" value="" />
                {uniqueCategories.map((c) => (
                  <Picker.Item key={c} label={c} value={c} />
                ))}
              </Picker>
            </View>
            <View style={styles.categoryInputContainer}>
              <TextInput
                style={[styles.input, styles.categoryInput]}
                placeholder="e.g., GROCERY"
                value={newCategory}
                onChangeText={(text) =>
                  setNewCategory(text.replace(/,/g, "").toUpperCase())
                }
                accessibilityLabel="New Category"
              />
              <TouchableOpacity
                style={styles.addCategoryButton}
                onPress={handleAddCategory}
                accessibilityLabel="Add Category"
                accessibilityRole="button"
              >
                <Feather name="plus" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            {newRule.categories.length > 0 && (
              <FlatList
                data={newRule.categories}
                renderItem={renderCategory}
                keyExtractor={(item) => item}
                style={styles.categoryList}
                scrollEnabled={false}
              />
            )}
            <Text style={styles.instruction}>
              Add categories one at a time. Leave blank for all categories.
            </Text>
            <View style={styles.ruleButtons}>
              <TouchableOpacity
                style={styles.saveRuleButton}
                onPress={handleSaveRule}
                accessibilityLabel="Save Cashback Rule"
                accessibilityRole="button"
              >
                <Feather name="save" size={24} color="#388E3C" />
                <Text style={styles.saveRuleButtonText}>Save Rule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteRuleButton}
                onPress={() =>
                  setNewRule({
                    onlineOffline: "Both",
                    paymentType: "Full Payment",
                    merchant: "",
                    percentage: "",
                    limit: "",
                    categories: [],
                  })
                }
                accessibilityLabel="Clear Cashback Rule"
                accessibilityRole="button"
              >
                <Feather name="trash-2" size={24} color="#D32F2F" />
                <Text style={styles.deleteRuleButtonText}>Clear Rule</Text>
              </TouchableOpacity>
            </View>
          </View>
          {cashbackRules.map((rule, index) => (
            <View key={index} style={styles.savedRuleContainer}>
              <Text style={styles.savedRuleText}>
                Rule {index + 1}: {rule.percentage}% on{" "}
                {rule.categories.join(", ") || "All Categories"} (
                {rule.merchant || "All Merchants"}, {rule.onlineOffline},{" "}
                {rule.paymentType})
                {rule.limit
                  ? ` up to ${settings.currency}${Number(rule.limit).toFixed(
                      2
                    )}`
                  : " (No Limit)"}
              </Text>
              <TouchableOpacity
                style={styles.deleteSavedRuleButton}
                onPress={() => handleDeleteRule(index)}
                accessibilityLabel={`Delete Cashback Rule ${index + 1}`}
                accessibilityRole="button"
              >
                <Feather name="trash-2" size={20} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.instruction}>
            Add cashback rules using the Save Rule button. Example: For a card
            offering 5% cashback up to {settings.currency}250 on groceries from
            Amazon:
            {"\n"}- Transaction Type: Online{"\n"}- Payment Type: Full Payment
            {"\n"}- Merchant: AMAZON{"\n"}- Cashback Percentage: 5{"\n"}-
            Cashback Limit: 250 (optional){"\n"}- Categories: GROCERY (optional)
            {"\n"}Leave Merchant, Limit, or Categories blank for all merchants,
            no cashback cap, or all categories.
          </Text>
          <Text style={styles.warning}>
            Cashback calculations depend on these rules. Ensure all fields are
            filled correctly.
          </Text>
        </>
      )}
      <Animated.View style={[styles.saveButton, { transform: [{ scale }] }]}>
        <TouchableOpacity
          onPress={editCard ? handleSaveEdit : handleSave}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel={editCard ? "Update Card" : "Save Card"}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>
            {editCard ? "Update Card" : "Save Card"}
          </Text>
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.sectionTitle}>Added Cards</Text>
      {cards.length === 0 ? (
        <Text style={styles.noData}>No cards added yet.</Text>
      ) : (
        <FlatList
          data={cards}
          renderItem={renderCard}
          keyExtractor={(item) => item.id}
          style={styles.list}
          scrollEnabled={false}
        />
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
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
    fontSize: 28,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 12,
    marginTop: 16,
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
  billingCycle: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  billingCycleInput: {
    flex: 1,
  },
  toggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  toggleLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#1A1A1A",
  },
  ruleContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  savedRuleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  savedRuleText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    flex: 1,
  },
  deleteSavedRuleButton: {
    padding: 8,
  },
  instruction: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#666666",
    marginBottom: 12,
    lineHeight: 20,
  },
  warning: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#D32F2F",
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  saveRuleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  saveRuleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#388E3C",
    marginLeft: 8,
  },
  deleteRuleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFEBEE",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  deleteRuleButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#D32F2F",
    marginLeft: 8,
  },
  ruleButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  categoryInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryInput: {
    flex: 1,
    marginRight: 8,
  },
  addCategoryButton: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryList: {
    marginBottom: 12,
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    marginRight: 8,
  },
  categoryText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#388E3C",
    marginRight: 8,
  },
  list: {
    marginBottom: 16,
  },
  card: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  cardText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 4,
  },
  cardIcons: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    paddingLeft: 12,
  },
  noData: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    marginBottom: 16,
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

export default YourCardsScreen;
