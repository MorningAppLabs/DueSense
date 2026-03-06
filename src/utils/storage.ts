import AsyncStorage from "@react-native-async-storage/async-storage";

export const saveToStorage = async <T>(
  key: string,
  value: T
): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to storage:`, error);
  }
};

export const loadFromStorage = async <T>(
  key: string,
  defaultValue: T
): Promise<T> => {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from storage:`, error);
    return defaultValue;
  }
};
