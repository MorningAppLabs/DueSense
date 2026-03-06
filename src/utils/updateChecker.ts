import { Alert, Linking } from "react-native";
import * as Application from "expo-application";

interface UpdateInfo {
  latest_version: string;
  update_message: string;
  apk_url: string;
}

const UPDATE_JSON_URL =
  "https://raw.githubusercontent.com/MorningAppLabs/DueSense/main/update.json";

/**
 * Compare version strings
 * Returns true if remoteVersion is greater than currentVersion
 */
const isNewerVersion = (
  currentVersion: string,
  remoteVersion: string
): boolean => {
  const current = currentVersion.split(".").map(Number);
  const remote = remoteVersion.split(".").map(Number);

  for (let i = 0; i < Math.max(current.length, remote.length); i++) {
    const currentPart = current[i] || 0;
    const remotePart = remote[i] || 0;

    if (remotePart > currentPart) return true;
    if (remotePart < currentPart) return false;
  }

  return false;
};

/**
 * Fetch update information from GitHub
 */
export const fetchUpdateInfo = async (): Promise<UpdateInfo | null> => {
  try {
    const response = await fetch(UPDATE_JSON_URL);
    if (!response.ok) {
      // Silently ignore 404 (update.json not yet published) or other HTTP errors
      return null;
    }
    const data: UpdateInfo = await response.json();
    return data;
  } catch {
    // Network offline or other transient error — ignored silently
    return null;
  }
};

/**
 * Check for updates and show alert if available
 * @param silent - If true, don't show "Already up to date" message
 */
export const checkForUpdates = async (silent: boolean = false) => {
  try {
    const currentVersion = Application.nativeApplicationVersion || "1.0.0";
    const updateInfo = await fetchUpdateInfo();

    if (!updateInfo) {
      if (!silent) {
        Alert.alert(
          "Error",
          "Unable to check for updates. Please check your internet connection."
        );
      }
      return;
    }

    if (isNewerVersion(currentVersion, updateInfo.latest_version)) {
      Alert.alert(
        "Update Available! 🎉",
        `Version ${updateInfo.latest_version} is now available!\n\n${updateInfo.update_message}`,
        [
          {
            text: "Later",
            style: "cancel",
          },
          {
            text: "Download",
            onPress: () => {
              Linking.openURL(updateInfo.apk_url);
            },
          },
        ]
      );
    } else {
      if (!silent) {
        Alert.alert(
          "You're Up to Date! ✨",
          `You're running the latest version (${currentVersion}).`
        );
      }
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    if (!silent) {
      Alert.alert("Error", "An error occurred while checking for updates.");
    }
  }
};
