import React, { useEffect, useCallback, Component, useState, useRef } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { useStore } from "./src/store/store";
import Toast from "react-native-toast-message";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as Updates from "expo-updates";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { checkForUpdates } from "./src/utils/updateChecker";
import * as LocalAuthentication from "expo-local-authentication";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Global notification handler — MUST be set before any component mounts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={{ color: "red", fontSize: 18 }}>
            Error: {this.state.error}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const { loadData } = useStore();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("./assets/fonts/Inter-Regular.ttf"),
    Inter_600SemiBold: require("./assets/fonts/Inter-SemiBold.ttf"),
    Inter_700Bold: require("./assets/fonts/Inter-Bold.ttf"),
  });
  const [locked, setLocked] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // Guard: prevent onLayoutRootView from ever running more than once
  const initDoneRef = useRef(false);

  const handleAuthenticate = useCallback(async () => {
    const [hasHw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hasHw || !enrolled) {
      setLocked(false);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to open DueSense",
      fallbackLabel: "Use PIN",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    if (result.success) setLocked(false);
  }, []);

  // Auto-trigger biometric prompt when lock screen appears
  useEffect(() => {
    if (authChecked && locked) {
      handleAuthenticate();
    }
  }, [authChecked, locked, handleAuthenticate]);

  const onLayoutRootView = useCallback(async () => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;
    if (fontsLoaded || fontError) {
      try {
        await loadData();

        // Request notification permissions (non-blocking, Android 13+)
        await Notifications.requestPermissionsAsync().catch(() => {});

        const currentSettings = useStore.getState().settings;
        if (currentSettings.biometricEnabled) {
          setLocked(true);
        }
        setAuthChecked(true);
        await SplashScreen.hideAsync();
        // EAS OTA: silently fetch and apply any available update in background
        if (!__DEV__) {
          Updates.checkForUpdateAsync()
            .then((update) => {
              if (update.isAvailable) {
                Updates.fetchUpdateAsync().then(() => Updates.reloadAsync()).catch(() => {});
              }
            })
            .catch(() => {});
        }
        // Check GitHub update.json for APK update nag (manual installs)
        setTimeout(() => checkForUpdates(true), 3000);
      } catch {
        setAuthChecked(true);
        await SplashScreen.hideAsync();
      }
    }
  }, [fontsLoaded, fontError, loadData]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      onLayoutRootView();
    }
  }, [fontsLoaded, fontError, onLayoutRootView]);

  // Add a timeout to prevent infinite null rendering
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!fontsLoaded && !fontError) {
          onLayoutRootView();
        }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError, onLayoutRootView]);

  if (!fontsLoaded && !fontError) return null;

  if (fontError) {
    return (
      <View style={styles.container}>
        <Text style={{ color: "red", fontSize: 18 }}>
          Font Error: {fontError.message}
        </Text>
      </View>
    );
  }

  if (authChecked && locked) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.lockScreen} edges={["top", "bottom"]}>
          <View style={styles.lockContent}>
            <View style={styles.lockIconWrap}>
              <Text style={styles.lockEmoji}>🔒</Text>
            </View>
            <Text style={styles.lockTitle}>DueSense is Locked</Text>
            <Text style={styles.lockSub}>Verify your identity to continue</Text>
            <TouchableOpacity style={styles.lockBtn} onPress={handleAuthenticate} activeOpacity={0.85}>
              <Text style={styles.lockBtnTxt}>Unlock</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <AppNavigator />
          <Toast />
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  lockScreen: {
    flex: 1,
    backgroundColor: "#F8F9FC",
  },
  lockContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  lockIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  lockEmoji: {
    fontSize: 40,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 8,
    textAlign: "center",
  },
  lockSub: {
    fontSize: 14,
    color: "#8898AA",
    textAlign: "center",
    marginBottom: 40,
  },
  lockBtn: {
    backgroundColor: "#6C63FF",
    paddingVertical: 14,
    paddingHorizontal: 56,
    borderRadius: 12,
  },
  lockBtnTxt: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
