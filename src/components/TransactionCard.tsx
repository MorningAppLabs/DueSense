import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useStore } from "../store/store";
import { Transaction, Card } from "../types/types";
import moment from "moment";

const { width } = Dimensions.get("window");

interface TransactionCardProps {
  transaction: Transaction;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  showCardName?: boolean;
  showPerson?: boolean;
  showStatus?: boolean;
}

const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  onEdit,
  onDelete,
  showCardName = false,
  showPerson = false,
  showStatus = false,
}) => {
  const { settings, cards } = useStore();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.98,
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

  const handleEdit = () => {
    if (onEdit) {
      onEdit(transaction);
    } else {
      Alert.alert(
        "Info",
        "Edit functionality not implemented for this context."
      );
    }
  };

  const handleDelete = () => {
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (onDelete) {
      onDelete(transaction.id);
    } else {
      useStore.setState((state: { transactions: Transaction[] }) => ({
        transactions: state.transactions.filter((t) => t.id !== transaction.id),
      }));
      Alert.alert("Success", "Transaction deleted successfully!");
    }
    setDeleteModalVisible(false);
  };

  const cardName =
    cards.find((c: Card) => c.id === transaction.cardId)?.name ||
    transaction.cardId;

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ scale }] },
        transaction.repaid ? styles.paid : styles.duo,
      ]}
    >
      <View style={styles.textContainer}>
        <Text style={styles.text}>
          Date: {moment(transaction.date).format("DD MMM YYYY")}
        </Text>
        {showCardName && <Text style={styles.text}>Card: {cardName}</Text>}
        <Text style={styles.text}>Merchant: {transaction.merchant}</Text>
        <Text style={styles.text}>Description: {transaction.description}</Text>
        <Text style={styles.text}>
          Amount: {settings.currency}
          {transaction.amount.toFixed(2)}
        </Text>
        {showPerson && (
          <Text style={styles.text}>
            For: {transaction.personName || "Myself"}
          </Text>
        )}
        {showStatus && (
          <Text style={styles.text}>
            Status: {transaction.repaid ? "Paid" : "Due"}
          </Text>
        )}
      </View>
      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              onPress={handleEdit}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.actionButton}
              accessibilityLabel="Edit Transaction"
              accessibilityRole="button"
            >
              <Feather name="edit" size={18} color="#1976D2" />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              onPress={handleDelete}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.actionButton}
              accessibilityLabel="Delete Transaction"
              accessibilityRole="button"
            >
              <Feather name="trash-2" size={18} color="#D32F2F" />
            </TouchableOpacity>
          )}
        </View>
      )}
      <Modal
        visible={deleteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete Transaction</Text>
            <Text style={styles.modalText}>
              Are you sure you want to delete this transaction? This action
              cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteModalVisible(false)}
                accessibilityLabel="Cancel Delete"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDelete}
                accessibilityLabel="Confirm Delete"
                accessibilityRole="button"
              >
                <Text style={[styles.modalButtonText, { color: "#D32F2F" }]}>
                  Delete
                </Text>
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
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    position: "relative", // Added for absolute positioning
  },
  duo: {
    backgroundColor: "#FFEBEE",
  },
  paid: {
    backgroundColor: "#E8F5E9",
  },
  textContainer: {
    padding: 12,
    maxWidth: width - 80, // Limit text width to prevent icon overflow
  },
  text: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 4,
  },
  actions: {
    position: "absolute", // Move to top-right
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10, // Reduced for tighter spacing
  },
  actionButton: {
    padding: 4,
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
    marginBottom: 12,
  },
  modalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#E0E0E0",
  },
  deleteButton: {
    backgroundColor: "#FFEBEE",
  },
  modalButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1A1A1A",
  },
});

export default TransactionCard;
