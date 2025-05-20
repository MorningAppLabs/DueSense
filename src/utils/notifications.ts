import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// Store notification identifiers
const storeNotificationIdentifier = async (
  type: "dueDate" | "owedMoney" | "billEmi",
  identifier: string
) => {
  try {
    await AsyncStorage.setItem(`notification_${type}`, identifier);
  } catch (error) {
    console.error("Failed to store notification identifier:", error);
  }
};

// Retrieve notification identifier
const getNotificationIdentifier = async (
  type: "dueDate" | "owedMoney" | "billEmi"
) => {
  try {
    return await AsyncStorage.getItem(`notification_${type}`);
  } catch (error) {
    console.error("Failed to retrieve notification identifier:", error);
    return null;
  }
};

// Schedule a daily notification
export const scheduleNotification = async (
  title: string,
  body: string,
  time: string, // Format: HH:00
  type: "dueDate" | "owedMoney" | "billEmi"
) => {
  const hasPermission = await requestPermissions();
  if (!hasPermission) {
    throw new Error("Notification permissions not granted");
  }

  const [hour, minute] = time.split(":").map(Number);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute !== 0) {
    throw new Error("Invalid time format. Use HH:00");
  }

  const trigger: Notifications.DailyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY, // Use enum value
    hour,
    minute,
  };

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
    },
    trigger,
  });

  // Store the identifier for the specific type
  await storeNotificationIdentifier(type, identifier);

  return identifier;
};

// Cancel notifications for a specific type
export const cancelNotifications = async (
  type: "dueDate" | "owedMoney" | "billEmi"
) => {
  const identifier = await getNotificationIdentifier(type);
  if (identifier) {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    await AsyncStorage.removeItem(`notification_${type}`);
  }
};
