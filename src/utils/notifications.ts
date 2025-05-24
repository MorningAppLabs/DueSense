import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "../store/store";

// Default notification time (e.g., 9:00 AM)
export const DEFAULT_NOTIFICATION_TIME = "09:00";

// Define the structure for notification preferences
interface NotificationPreference {
  enabled: boolean;
  time: string; // HH:MM format
}

// Function to store notification preference
export const storeNotificationPreference = async (
  type: "dueDate" | "owedMoney" | "billEmi",
  enabled: boolean,
  time: string
) => {
  try {
    const preference: NotificationPreference = { enabled, time };
    await AsyncStorage.setItem(
      `notification_preference_${type}`,
      JSON.stringify(preference)
    );
  } catch (error) {
    console.error("Failed to store notification preference:", error);
  }
};

// Function to retrieve notification preference
export const getNotificationPreference = async (
  type: "dueDate" | "owedMoney" | "billEmi"
): Promise<NotificationPreference | null> => {
  try {
    const preferenceString = await AsyncStorage.getItem(
      `notification_preference_${type}`
    );
    if (preferenceString) {
      return JSON.parse(preferenceString);
    }
    return null;
  } catch (error) {
    console.error("Failed to retrieve notification preference:", error);
    return null;
  }
};

// Request notification permissions
export const requestPermissions = async () => {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== "granted") {
    return false;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }
  return true;
};

// Schedule an event-based notification
const scheduleEventNotification = async (
  title: string,
  body: string,
  date: Date // The specific date and time for the notification
) => {
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    console.warn(
      "Notification permissions not granted. Cannot schedule notification."
    );
    return null; // Return null if permissions are not granted
  }

  try {
    // Use CalendarTriggerInput to specify the exact date and time
    const trigger: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR, // Fixed type property
      year: date.getFullYear(),
      month: date.getMonth() + 1, // Month is 0-indexed in Date object, 1-indexed in CalendarTriggerInput
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
      repeats: false, // One-time notification
    };

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: "default",
      },
      trigger,
    });

    console.log(`Scheduled notification with identifier: ${identifier}`);
    return identifier; // Return the identifier
  } catch (error) {
    console.error("Failed to schedule event notification:", error);
    return null;
  }
};

// Schedule Due Date Reminder
export const scheduleDueDateReminder = async (
  cardName: string,
  dueDate: Date,
  notificationTime: string // HH:MM format from settings
) => {
  const preference = await getNotificationPreference("dueDate");
  if (!preference || !preference.enabled) {
    console.log("Due Date Reminder is disabled in settings.");
    return null; // Don't schedule if disabled
  }

  const [hour, minute] = notificationTime.split(":").map(Number);
  const scheduleDate = new Date(dueDate);
  scheduleDate.setHours(hour, minute, 0, 0); // Set the time based on user preference

  // Ensure the scheduled date is in the future
  if (scheduleDate <= new Date()) {
    console.log(
      "Due date for notification is in the past or present. Not scheduling."
    );
    return null;
  }

  const title = `Due Sense: Bill Due Soon for ${cardName}`;
  const body = `Your bill for ${cardName} is due on ${dueDate.toLocaleDateString()}.`; // Customize body

  return scheduleEventNotification(title, body, scheduleDate);
};

// Schedule Owed Money Reminder
export const scheduleOwedMoneyReminder = async (
  personName: string,
  owedAmount: number,
  transactionDate: Date, // Date of the transaction
  transactionId: string, // ID to track the notification
  notificationTime: string // HH:MM format from settings
) => {
  const preference = await getNotificationPreference("owedMoney");
  if (!preference || !preference.enabled) {
    console.log("Owed Money Reminder is disabled in settings.");
    return null; // Don't schedule if disabled
  }

  // Schedule 10 days after the transaction date
  const reminderDate = new Date(transactionDate);
  reminderDate.setDate(transactionDate.getDate() + 10); // Adjust as needed

  const [hour, minute] = notificationTime.split(":").map(Number);
  const scheduleDate = new Date(reminderDate);
  scheduleDate.setHours(hour, minute, 0, 0);

  // Ensure the scheduled date is in the future
  if (scheduleDate <= new Date()) {
    console.log(
      "Owed money reminder date is in the past or present. Not scheduling."
    );
    return null;
  }

  const title = `Due Sense: Owed Money Reminder for ${personName}`;
  const body = `Remember to collect ${owedAmount} from ${personName}.`; // Customize body

  const identifier = await scheduleEventNotification(title, body, scheduleDate);
  if (identifier) {
    // Store the notification ID
    useStore.getState().setState({
      notificationIds: {
        ...useStore.getState().notificationIds,
        [`owedMoney_${transactionId}`]: identifier,
      },
    });
  }
  return identifier;
};

// Schedule Bill and EMI Reminder
export const scheduleBillAndEmiReminder = async (
  cardName: string,
  billDate: Date,
  notificationTime: string // HH:MM format from settings
) => {
  const preference = await getNotificationPreference("billEmi");
  if (!preference || !preference.enabled) {
    console.log("Bill and EMI Reminder is disabled in settings.");
    return null; // Don't schedule if disabled
  }

  // Schedule 10 days after the bill generation date
  const tenDaysAfterBill = new Date(billDate);
  tenDaysAfterBill.setDate(tenDaysAfterBill.getDate() + 10);

  const [hour, minute] = notificationTime.split(":").map(Number);
  const scheduleDate = new Date(tenDaysAfterBill); // Use the calculated reminder date
  scheduleDate.setHours(hour, minute, 0, 0);

  // Ensure the scheduled date is in the future
  if (scheduleDate <= new Date()) {
    console.log(
      "Bill and EMI reminder date is in the past or present. Not scheduling."
    );
    return null;
  }

  const title = `Due Sense: Bill and EMI Reminder for ${cardName}`;
  const body = `Check your recent bill and upcoming EMIs for ${cardName}.`; // Customize body

  return scheduleEventNotification(title, body, scheduleDate);
};

// Function to cancel a specific notification by identifier
export const cancelNotificationById = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`Canceled notification with identifier: ${identifier}`);
  } catch (error) {
    console.error(
      `Failed to cancel notification with identifier ${identifier}:`,
      error
    );
  }
};
