import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Modal,
  Dimensions,
  Animated,
  SafeAreaView,
  Platform, // Import Platform
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Linking from "expo-linking";
import { useStore } from "../store/store";
import {
  storeNotificationPreference, // New Import
  getNotificationPreference, // New Import
  DEFAULT_NOTIFICATION_TIME, // New Import
} from "../utils/notifications";
import DateTimePicker from "@react-native-community/datetimepicker"; // New Import
import { currencies } from "../constants/currencies";
import { privacyPolicy } from "../constants/privacyPolicy";
import { termsOfUse } from "../constants/termsOfUse";
import { changelogs } from "../constants/changelogs";
import { acknowledgments } from "../constants/acknowledgments";

const { width } = Dimensions.get("window");

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, setState } = useStore();
  const [currency, setCurrency] = useState(settings.currency);

  // State for notification preferences
  const [dueDateReminderEnabled, setDueDateReminderEnabled] = useState(false);
  const [dueDateReminderTime, setDueDateReminderTime] = useState(
    settings.notificationTimes?.dueDate || DEFAULT_NOTIFICATION_TIME // Initialize with stored or default
  );
  const [owedMoneyReminderEnabled, setOwedMoneyReminderEnabled] =
    useState(false);
  const [owedMoneyReminderTime, setOwedMoneyReminderTime] = useState(
    settings.notificationTimes?.owedMoney || DEFAULT_NOTIFICATION_TIME // Initialize with stored or default
  );
  const [billEmiReminderEnabled, setBillEmiReminderEnabled] = useState(false); // Changed initial state to false
  const [billEmiReminderTime, setBillEmiReminderTime] = useState(
    settings.notificationTimes?.billEmi || DEFAULT_NOTIFICATION_TIME // Initialize with stored or default
  );

  // State for time picker visibility
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showOwedMoneyDatePicker, setShowOwedMoneyDatePicker] = useState(false);
  const [showBillEmiDatePicker, setShowBillEmiDatePicker] = useState(false);

  const [localSync, setLocalSync] = useState(settings.sync.local);
  const [cloudSync, setCloudSync] = useState(settings.sync.cloud);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showChangelogs, setShowChangelogs] = useState(false);
  const [showAcknowledgments, setShowAcknowledgments] = useState(false);

  const scale = new Animated.Value(1);

  // Load notification preferences on component mount
  useEffect(() => {
    const loadPreferences = async () => {
      const dueDatePref = await getNotificationPreference("dueDate");
      if (dueDatePref) {
        setDueDateReminderEnabled(dueDatePref.enabled);
        setDueDateReminderTime(dueDatePref.time || DEFAULT_NOTIFICATION_TIME);
      }

      const owedMoneyPref = await getNotificationPreference("owedMoney");
      if (owedMoneyPref) {
        setOwedMoneyReminderEnabled(owedMoneyPref.enabled);
        setOwedMoneyReminderTime(
          owedMoneyPref.time || DEFAULT_NOTIFICATION_TIME
        );
      }

      const billEmiPref = await getNotificationPreference("billEmi");
      if (billEmiPref) {
        setBillEmiReminderEnabled(billEmiPref.enabled);
        setBillEmiReminderTime(billEmiPref.time || DEFAULT_NOTIFICATION_TIME);
      }
    };

    loadPreferences();
  }, []); // Empty dependency array ensures this runs only once on mount

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

  const handleCurrencyChange = (value: string) => {
    setCurrency(value);
    updateSettings({ currency: value });
  };

  const handleBackup = async () => {
    try {
      const data = {
        cards: useStore.getState().cards,
        transactions: useStore.getState().transactions,
        repayments: useStore.getState().repayments,
        settings: useStore.getState().settings,
        merchants: useStore.getState().merchants,
        persons: useStore.getState().persons,
      };
      const backupPath = `${
        FileSystem.cacheDirectory
      }DueSense_backup_${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(backupPath, JSON.stringify(data));
      await Sharing.shareAsync(backupPath, {
        mimeType: "application/json",
        dialogTitle: "Share or Save Backup",
      });
      Alert.alert("Success", "Backup created! Choose where to save or share.");
    } catch (error) {
      Alert.alert("Error", "Failed to create or share backup.");
    }
  };

  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) {
        return;
      }
      const { uri } = result.assets[0];
      const content = await FileSystem.readAsStringAsync(uri);
      const data = JSON.parse(content);

      if (
        !data.cards ||
        !data.transactions ||
        !data.repayments ||
        !data.settings ||
        !data.merchants ||
        !data.persons
      ) {
        throw new Error("Invalid backup file: Missing required data.");
      }

      setState({
        cards: data.cards,
        transactions: data.transactions,
        repayments: data.repayments,
        settings: data.settings,
        merchants: data.merchants,
        persons: data.persons,
      });

      Alert.alert("Success", "Data restored successfully!");
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to restore data. Ensure the file is a valid DueSense backup."
      );
    }
  };

  // Updated handleNotificationToggle
  const handleNotificationToggle = async (
    type: "dueDate" | "owedMoney" | "billEmi",
    enabled: boolean
  ) => {
    if (type === "dueDate") {
      setDueDateReminderEnabled(enabled);
      await storeNotificationPreference(
        "dueDate",
        enabled,
        dueDateReminderTime
      );
      updateSettings({
        notificationTimes: {
          ...settings.notificationTimes,
          dueDate: dueDateReminderTime,
        },
      });
    } else if (type === "owedMoney") {
      setOwedMoneyReminderEnabled(enabled);
      await storeNotificationPreference(
        "owedMoney",
        enabled,
        owedMoneyReminderTime
      );
      updateSettings({
        notificationTimes: {
          ...settings.notificationTimes,
          owedMoney: owedMoneyReminderTime,
        },
      });
    } else {
      // billEmi
      setBillEmiReminderEnabled(enabled);
      await storeNotificationPreference(
        "billEmi",
        enabled,
        billEmiReminderTime
      );
      updateSettings({
        notificationTimes: {
          ...settings.notificationTimes,
          billEmi: billEmiReminderTime,
        },
      });
    }
    // Note: Scheduling/canceling event-based notifications happens elsewhere
    // in your app based on relevant events (e.g., bill generation).
    // This function only updates the user's preference.
  };

  // Handlers for time picker changes
  const handleDueDateTimeChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowDueDatePicker(Platform.OS === "ios");
    const timeString = `${currentDate
      .getHours()
      .toString()
      .padStart(2, "0")}:${currentDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    setDueDateReminderTime(timeString);
    if (dueDateReminderEnabled) {
      // Only save if the reminder is enabled
      storeNotificationPreference("dueDate", true, timeString);
      updateSettings({
        notificationTimes: {
          ...settings.notificationTimes,
          dueDate: timeString,
        },
      });
    }
  };

  const handleOwedMoneyTimeChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowOwedMoneyDatePicker(Platform.OS === "ios");
    const timeString = `${currentDate
      .getHours()
      .toString()
      .padStart(2, "0")}:${currentDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    setOwedMoneyReminderTime(timeString);
    if (owedMoneyReminderEnabled) {
      // Only save if the reminder is enabled
      storeNotificationPreference("owedMoney", true, timeString);
      updateSettings({
        notificationTimes: {
          ...settings.notificationTimes,
          owedMoney: timeString,
        },
      });
    }
  };

  const handleBillEmiTimeChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || new Date();
    setShowBillEmiDatePicker(Platform.OS === "ios");
    const timeString = `${currentDate
      .getHours()
      .toString()
      .padStart(2, "0")}:${currentDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    setBillEmiReminderTime(timeString);
    if (billEmiReminderEnabled) {
      // Only save if the reminder is enabled
      storeNotificationPreference("billEmi", true, timeString);
      updateSettings({
        notificationTimes: {
          ...settings.notificationTimes,
          billEmi: timeString,
        },
      });
    }
  };

  const handleSyncToggle = (type: "local" | "cloud", enabled: boolean) => {
    if (type === "local") {
      setLocalSync(enabled);
      if (enabled) {
        Alert.alert(
          "Info",
          "Local sync feature is not implemented yet. Use Backup Data for sharing and saving local backups."
        );
      }
    } else {
      setCloudSync(enabled);
      if (enabled) {
        Alert.alert(
          "Info",
          "Cloud sync feature is not implemented yet. Use Backup Data for sharing and saving local backups."
        );
      }
    }
    updateSettings({ sync: { local: localSync, cloud: enabled } });
  };

  const handleContact = async () => {
    try {
      await Linking.openURL(
        "mailto:morningshows.me@gmail.com?subject=DueSense Bug/Feature Request"
      );
    } catch (error) {
      Alert.alert("Error", "Failed to open email app.");
    }
  };

  const handleJoinTelegram = async () => {
    try {
      await Linking.openURL("https://t.me/duesense");
    } catch (error) {
      Alert.alert("Error", "Failed to open Telegram.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Currency</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={currency}
            onValueChange={handleCurrencyChange}
            style={styles.picker}
          >
            {currencies.map((curr) => (
              <Picker.Item
                key={curr.value}
                label={curr.label}
                value={curr.value}
              />
            ))}
          </Picker>
        </View>
        <Text style={styles.sectionTitle}>Backup/Restore</Text>
        <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
          <TouchableOpacity
            onPress={handleBackup}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Backup Data"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Backup Data</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: "#388E3C", transform: [{ scale }] },
          ]}
        >
          <TouchableOpacity
            onPress={handleRestore}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Restore Data"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Restore Data</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.sectionTitle}>Sync</Text>
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>Enable Local Sync</Text>
          <Switch
            value={localSync}
            onValueChange={(value) => handleSyncToggle("local", value)}
            accessibilityLabel="Enable Local Sync"
          />
        </View>
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>Enable Cloud Sync</Text>
          <Switch
            value={cloudSync}
            onValueChange={(value) => handleSyncToggle("cloud", value)}
            accessibilityLabel="Enable Cloud Sync"
          />
        </View>
        <Text style={styles.sectionTitle}>Notifications</Text>

        {/* Due Date Reminder */}
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>Due Date Reminder</Text>
          <Switch
            value={dueDateReminderEnabled}
            onValueChange={(value) =>
              handleNotificationToggle("dueDate", value)
            }
            accessibilityLabel="Due Date Reminder"
          />
        </View>
        {dueDateReminderEnabled && (
          <View style={styles.timePickerContainer}>
            <Text style={styles.timeLabel}>Time:</Text>
            {Platform.OS === "android" ? (
              <TouchableOpacity onPress={() => setShowDueDatePicker(true)}>
                <Text style={styles.timeText}>{dueDateReminderTime}</Text>
              </TouchableOpacity>
            ) : (
              <DateTimePicker
                value={new Date(`2000-01-01T${dueDateReminderTime}:00`)} // Use a dummy date, only time matters
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleDueDateTimeChange}
              />
            )}
            {showDueDatePicker && Platform.OS === "android" && (
              <DateTimePicker
                value={new Date(`2000-01-01T${dueDateReminderTime}:00`)} // Use a dummy date, only time matters
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleDueDateTimeChange}
              />
            )}
          </View>
        )}

        {/* Owed Money Reminder */}
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>Owed-Money Reminder</Text>
          <Switch
            value={owedMoneyReminderEnabled}
            onValueChange={(value) =>
              handleNotificationToggle("owedMoney", value)
            }
            accessibilityLabel="Owed-Money Reminder"
          />
        </View>
        {owedMoneyReminderEnabled && (
          <View style={styles.timePickerContainer}>
            <Text style={styles.timeLabel}>Time:</Text>
            {Platform.OS === "android" ? (
              <TouchableOpacity
                onPress={() => setShowOwedMoneyDatePicker(true)}
              >
                <Text style={styles.timeText}>{owedMoneyReminderTime}</Text>
              </TouchableOpacity>
            ) : (
              <DateTimePicker
                value={new Date(`2000-01-01T${owedMoneyReminderTime}:00`)} // Use a dummy date, only time matters
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleOwedMoneyTimeChange}
              />
            )}
            {showOwedMoneyDatePicker && Platform.OS === "android" && (
              <DateTimePicker
                value={new Date(`2000-01-01T${owedMoneyReminderTime}:00`)} // Use a dummy date, only time matters
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleOwedMoneyTimeChange}
              />
            )}
          </View>
        )}

        {/* Bill and EMI Reminder */}
        <View style={styles.toggle}>
          <Text style={styles.toggleLabel}>Bill and EMI Reminder</Text>
          <Switch
            value={billEmiReminderEnabled}
            onValueChange={(value) =>
              handleNotificationToggle("billEmi", value)
            }
            accessibilityLabel="Bill and EMI Reminder"
          />
        </View>
        {billEmiReminderEnabled && (
          <View style={styles.timePickerContainer}>
            <Text style={styles.timeLabel}>Time:</Text>
            {Platform.OS === "android" ? (
              <TouchableOpacity onPress={() => setShowBillEmiDatePicker(true)}>
                <Text style={styles.timeText}>{billEmiReminderTime}</Text>
              </TouchableOpacity>
            ) : (
              <DateTimePicker
                value={new Date(`2000-01-01T${billEmiReminderTime}:00`)} // Use a dummy date, only time matters
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleBillEmiTimeChange}
              />
            )}
            {showBillEmiDatePicker && Platform.OS === "android" && (
              <DateTimePicker
                value={new Date(`2000-01-01T${billEmiReminderTime}:00`)} // Use a dummy date, only time matters
                mode="time"
                is24Hour={true}
                display="default"
                onChange={handleBillEmiTimeChange}
              />
            )}
          </View>
        )}

        <Text style={styles.sectionTitle}>Privacy Policy</Text>
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: "#666666", transform: [{ scale }] },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowPrivacy(true)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="View Privacy Policy"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>View Privacy Policy</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.sectionTitle}>Terms of Use</Text>
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: "#666666", transform: [{ scale }] },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowTerms(true)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="View Terms of Use"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>View Terms of Use</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>Developer: Supravat</Text>
        <Text style={styles.aboutText}>
          App Version: {changelogs[0]?.version || "1.0.0"}
        </Text>
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: "#666666", transform: [{ scale }] },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowChangelogs(true)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="View Changelogs"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>View Changelogs</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
          <TouchableOpacity
            onPress={handleContact}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Email Developer"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Email Developer</Text>
          </TouchableOpacity>
        </Animated.View>
        <Animated.View style={[styles.button, { transform: [{ scale }] }]}>
          <TouchableOpacity
            onPress={handleJoinTelegram}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="Join Telegram"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Join Telegram</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={styles.sectionTitle}>Acknowledgments</Text>
        <Animated.View
          style={[
            styles.button,
            { backgroundColor: "#666666", transform: [{ scale }] },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowAcknowledgments(true)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            accessibilityLabel="View Acknowledgments"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>View Acknowledgments</Text>
          </TouchableOpacity>
        </Animated.View>
        <Modal
          visible={showPrivacy}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowPrivacy(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <Text style={styles.modalText}>{privacyPolicy}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowPrivacy(false)}
                accessibilityLabel="Close Privacy Policy"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={showTerms}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowTerms(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Terms of Use</Text>
              <Text style={styles.modalText}>{termsOfUse}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowTerms(false)}
                accessibilityLabel="Close Terms of Use"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={showChangelogs}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowChangelogs(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Changelogs</Text>
              {changelogs.map((log) => (
                <View key={log.version} style={styles.changelogEntry}>
                  <Text style={styles.changelogText}>
                    Version {log.version} ({log.date})
                  </Text>
                  <Text style={styles.changelogDescription}>
                    {log.description}
                  </Text>
                </View>
              ))}
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowChangelogs(false)}
                accessibilityLabel="Close Changelogs"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
        <Modal
          visible={showAcknowledgments}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowAcknowledgments(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.modalTitle}>Acknowledgments</Text>
              <Text style={styles.modalText}>{acknowledgments}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowAcknowledgments(false)}
                accessibilityLabel="Close Acknowledgments"
                accessibilityRole="button"
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
    paddingBottom: 80,
  },
  header: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
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
  toggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  toggleLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
  },
  button: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  aboutText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
    marginBottom: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalContent: {
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#1A1A1A",
    marginBottom: 16,
  },
  modalText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
    marginBottom: 16,
  },
  modalButton: {
    backgroundColor: "#E0E0E0",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    alignSelf: "center",
    marginTop: 20,
  },
  modalButtonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#1A1A1A",
  },
  changelogEntry: {
    marginBottom: 16,
  },
  changelogText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#1A1A1A",
  },
  changelogDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#4A4A4A",
  },
  pickerContainer: {
    // Reused for time picker in iOS
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    overflow: "hidden",
  },
  picker: {
    // Reused for time picker in iOS
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
  },
  timePickerContainer: {
    // New style for time picker container
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingLeft: 20, // Indent the time picker
  },
  timeLabel: {
    // New style for time label
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#1A1A1A",
    marginRight: 10,
  },
  timeText: {
    // New style for tappable time text on Android
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#007AFF", // Adjust color
  },
});

export default SettingsScreen;
