import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_NOTIFICATION_TIME = "09:00";

export const storeNotificationPreference = async (
  type: "dueDate" | "owedMoney" | "billEmi",
  enabled: boolean,
  time: string
) => {
  try {
    const preference = { enabled, time };
    await AsyncStorage.setItem(
      `notification_${type}`,
      JSON.stringify(preference)
    );
    console.log(`Stored ${type} notification preference:`, preference);
  } catch (error) {
    console.error(`Failed to store ${type} notification preference:`, error);
  }
};

export const getNotificationPreference = async (
  type: "dueDate" | "owedMoney" | "billEmi"
) => {
  try {
    const value = await AsyncStorage.getItem(`notification_${type}`);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Failed to get ${type} notification preference:`, error);
    return null;
  }
};

export const scheduleDueDateReminder = async (
  cardName: string,
  dueDate: Date,
  time: string
) => {
  const [hour, minute] = time.split(":").map(Number);
  const scheduleDate = new Date(dueDate);
  scheduleDate.setHours(hour, minute, 0, 0);

  const now = new Date();
  if (scheduleDate <= now) {
    console.warn(
      `Due date ${scheduleDate.toISOString()} is in the past. Skipping notification.`
    );
    return null;
  }

  const trigger = {
    type: "timeInterval",
    seconds: Math.floor((scheduleDate.getTime() - now.getTime()) / 1000),
    repeats: false,
  } as Notifications.TimeIntervalTriggerInput;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Bill maybe generated for this card ${cardName}`,
        body: `Pay your bill. Collect the owed money from friends if any owed amount is there.`,
      },
      trigger,
    });
    console.log(
      `Scheduled due date notification with identifier: ${identifier} for ${scheduleDate.toISOString()}`
    );
    return identifier;
  } catch (error) {
    console.error(
      `Failed to schedule due date notification for ${cardName} at ${scheduleDate.toISOString()}:`,
      error
    );
    return null;
  }
};

export const scheduleBillAndEmiReminder = async (
  cardName: string,
  billDate: Date,
  time: string
) => {
  const [hour, minute] = time.split(":").map(Number);
  const scheduleDate = new Date(billDate);
  scheduleDate.setHours(hour, minute, 0, 0);

  const now = new Date();
  if (scheduleDate <= now) {
    console.warn(
      `Bill date ${scheduleDate.toISOString()} is in the past. Skipping notification.`
    );
    return null;
  }

  const trigger = {
    type: "timeInterval",
    seconds: Math.floor((scheduleDate.getTime() - now.getTime()) / 1000),
    repeats: false,
  } as Notifications.TimeIntervalTriggerInput;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Bill/EMI Reminder for ${cardName}`,
        body: `Your bill/EMI for ${cardName} is due on ${billDate.toLocaleDateString()}.`,
      },
      trigger,
    });
    console.log(
      `Scheduled bill/EMI notification with identifier: ${identifier} for ${scheduleDate.toISOString()}`
    );
    return identifier;
  } catch (error) {
    console.error(
      `Failed to schedule bill/EMI notification for ${cardName} at ${scheduleDate.toISOString()}:`,
      error
    );
    return null;
  }
};

export const scheduleOwedMoneyReminder = async (
  personName: string,
  amount: number,
  date: Date,
  transactionId: string,
  time: string
) => {
  const [hour, minute] = time.split(":").map(Number);
  const scheduleDate = new Date(date);
  scheduleDate.setHours(hour, minute, 0, 0);

  const now = new Date();
  if (scheduleDate <= now) {
    console.warn(
      `Owed money date ${scheduleDate.toISOString()} is in the past. Skipping notification.`
    );
    return null;
  }

  const trigger = {
    type: "timeInterval",
    seconds: Math.floor((scheduleDate.getTime() - now.getTime()) / 1000),
    repeats: false,
  } as Notifications.TimeIntervalTriggerInput;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Owed Money Reminder`,
        body: `${personName} owes you ${amount} for a transaction on ${date.toLocaleDateString()}.`,
        data: { transactionId },
      },
      trigger,
    });
    console.log(
      `Scheduled owed money notification with identifier: ${identifier} for ${scheduleDate.toISOString()}`
    );
    return identifier;
  } catch (error) {
    console.error(
      `Failed to schedule owed money notification for ${personName} at ${scheduleDate.toISOString()}:`,
      error
    );
    return null;
  }
};

export const scheduleGeneralOwedMoneyReminder = async (
  date: Date,
  time: string
) => {
  const [hour, minute] = time.split(":").map(Number);
  const scheduleDate = new Date(date);
  scheduleDate.setHours(hour, minute, 0, 0);

  const now = new Date();
  if (scheduleDate <= now) {
    console.warn(
      `General owed money date ${scheduleDate.toISOString()} is in the past. Skipping notification.`
    );
    return null;
  }

  const trigger = {
    type: "timeInterval",
    seconds: Math.floor((scheduleDate.getTime() - now.getTime()) / 1000),
    repeats: false,
  } as Notifications.TimeIntervalTriggerInput;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Owed Money Reminder`,
        body: `You owe money from people. Remind them.`,
      },
      trigger,
    });
    console.log(
      `Scheduled general owed money notification with identifier: ${identifier} for ${scheduleDate.toISOString()}`
    );
    return identifier;
  } catch (error) {
    console.error(
      `Failed to schedule general owed money notification at ${scheduleDate.toISOString()}:`,
      error
    );
    return null;
  }
};

export const cancelNotificationById = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`Canceled notification with identifier: ${identifier}`);
  } catch (error) {
    console.error(`Failed to cancel notification ${identifier}:`, error);
  }
};
