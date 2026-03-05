import React, { useEffect, useCallback, Component } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AppNavigator from "./src/navigation/AppNavigator";
import { useStore } from "./src/store/store";
import Toast from "react-native-toast-message";
import { StyleSheet, View, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { checkForUpdates } from "./src/utils/updateChecker";

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    console.error("ErrorBoundary caught:", error.message, error.stack);
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
    Inter_700Bold: require("./assets/fonts/Inter-Bold.ttf"),
    Inter_600SemiBold: require("./assets/fonts/Inter-SemiBold.ttf"),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      try {
        console.log("Loading data...");
        await loadData();
        console.log("Data loaded successfully");
        await SplashScreen.hideAsync();
        
        // Check for updates after app loads (silent mode)
        setTimeout(() => {
          checkForUpdates(true);
        }, 2000); // Wait 2 seconds after launch to check for updates
      } catch (error: any) {
        console.error("loadData error:", error.message, error.stack);
        await SplashScreen.hideAsync();
      }
    } else {
      console.warn(
        "Fonts not loaded and no error, delaying splash screen hide"
      );
    }
  }, [fontsLoaded, fontError, loadData]);

  useEffect(() => {
    console.log(
      "Font status - fontsLoaded:",
      fontsLoaded,
      "fontError:",
      fontError
    );
    if (fontsLoaded || fontError) {
      onLayoutRootView();
    }
  }, [fontsLoaded, fontError, onLayoutRootView]);

  // Add a timeout to prevent infinite null rendering
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!fontsLoaded && !fontError) {
        console.warn("Font loading timed out, proceeding without fonts");
        onLayoutRootView();
      }
    }, 5000); // 5-second timeout
    return () => clearTimeout(timeout);
  }, [fontsLoaded, fontError, onLayoutRootView]);

  if (!fontsLoaded && !fontError) {
    console.log("Rendering null due to fonts not loaded");
    return null;
  }

  if (fontError) {
    console.error("Font loading error:", fontError.message, fontError.stack);
    return (
      <View style={styles.container}>
        <Text style={{ color: "red", fontSize: 18 }}>
          Font Error: {fontError.message}
        </Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <View onLayout={onLayoutRootView} style={{ flex: 1 }}>
          <NavigationContainer>
            <AppNavigator />
            <Toast />
          </NavigationContainer>
        </View>
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
});
