import React, { useRef } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform, PanResponder, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import HomeScreen from "../screens/HomeScreen";
import AddSpendingScreen from "../screens/AddSpendingScreen";
import RepayToCardScreen from "../screens/RepayToCardScreen";
import BestFitCardScreen from "../screens/BestFitCardScreen";
import ShowReportScreen from "../screens/ShowReportScreen";
import MoneyOwedScreen from "../screens/MoneyOwedScreen";
import YourCardsScreen from "../screens/YourCardsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SubscriptionsScreen from "../screens/SubscriptionsScreen";
import ReportExportScreen from "../screens/ReportExportScreen";
import { COLORS } from "../theme/theme";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_CONFIG = [
  { name: "Home",       icon: "home"        as keyof typeof Feather.glyphMap, label: "Home"     },
  { name: "Reports",    icon: "bar-chart-2" as keyof typeof Feather.glyphMap, label: "Reports"  },
  { name: "Money Owed", icon: "users"       as keyof typeof Feather.glyphMap, label: "Owed"     },
  { name: "Cards",      icon: "credit-card" as keyof typeof Feather.glyphMap, label: "Cards"    },
  { name: "Settings",   icon: "settings"    as keyof typeof Feather.glyphMap, label: "Settings" },
] as const;

// ──────────────────────────────────────────────────────────────────
// Custom Tab Bar — fully controlled, no overflow clipping issues
// ──────────────────────────────────────────────────────────────────
const CustomTabBar: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();
  const BAR_CONTENT_H = Platform.OS === "ios" ? 56 : 58;

  return (
    <View
      style={[
        styles.tabBar,
        { height: BAR_CONTENT_H + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {TAB_CONFIG.map((tab, idx) => {
        const isFocused = state.index === idx;
        return (
          <Pressable
            key={tab.name}
            style={styles.tabItem}
            onPress={() => { if (!isFocused) navigation.navigate(tab.name as any); }}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isFocused }}
          >
            <View style={[styles.iconPill, isFocused && styles.iconPillActive]}>
              <Feather
                name={tab.icon}
                size={20}
                color={isFocused ? COLORS.primary : COLORS.textMuted}
              />
            </View>
            <Text
              style={[
                styles.tabLabel,
                { color: isFocused ? COLORS.primary : COLORS.textMuted },
                isFocused && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// ──────────────────────────────────────────────────────────────────
// Swipe gesture to cycle tabs
// ──────────────────────────────────────────────────────────────────
const TAB_NAMES = TAB_CONFIG.map((t) => t.name);

const SwipeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigation = useNavigation<any>();
  const currentIndex = useNavigationState((state) => state.index);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5 && Math.abs(gs.dx) > 12,
      onPanResponderRelease: (_, gs) => {
        if (Math.abs(gs.dx) < 60) return;
        if (gs.dx < 0) {
          const next = Math.min(currentIndex + 1, TAB_NAMES.length - 1);
          if (next !== currentIndex) navigation.navigate(TAB_NAMES[next] as any);
        } else {
          const prev = Math.max(currentIndex - 1, 0);
          if (prev !== currentIndex) navigation.navigate(TAB_NAMES[prev] as any);
        }
      },
    })
  ).current;

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
};

// ──────────────────────────────────────────────────────────────────
// Tab Navigator — uses our custom tab bar
// ──────────────────────────────────────────────────────────────────
const TabNavigator: React.FC = () => (
  <Tab.Navigator
    screenOptions={{ headerShown: false }}
    tabBar={(props) => <CustomTabBar {...props} />}
  >
    <Tab.Screen name="Home">
      {() => <SwipeWrapper><HomeScreen /></SwipeWrapper>}
    </Tab.Screen>
    <Tab.Screen name="Reports">
      {() => <SwipeWrapper><ShowReportScreen /></SwipeWrapper>}
    </Tab.Screen>
    <Tab.Screen name="Money Owed">
      {() => <SwipeWrapper><MoneyOwedScreen /></SwipeWrapper>}
    </Tab.Screen>
    <Tab.Screen name="Cards">
      {() => <SwipeWrapper><YourCardsScreen /></SwipeWrapper>}
    </Tab.Screen>
    <Tab.Screen name="Settings">
      {() => <SwipeWrapper><SettingsScreen /></SwipeWrapper>}
    </Tab.Screen>
  </Tab.Navigator>
);

// ──────────────────────────────────────────────────────────────────
// Root Stack Navigator
// ──────────────────────────────────────────────────────────────────
const AppNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Main" component={TabNavigator} />
    <Stack.Screen name="AddSpending"    component={AddSpendingScreen}    options={{ animation: "slide_from_bottom" }} />
    <Stack.Screen name="RepayToCard"    component={RepayToCardScreen}    options={{ animation: "slide_from_bottom" }} />
    <Stack.Screen name="BestFitCard"    component={BestFitCardScreen}    options={{ animation: "slide_from_right"  }} />
    <Stack.Screen name="Subscriptions"  component={SubscriptionsScreen}  options={{ animation: "slide_from_right"  }} />
    <Stack.Screen name="ReportExport"   component={ReportExportScreen}   options={{ animation: "slide_from_bottom" }} />
  </Stack.Navigator>
);

const styles = StyleSheet.create({
  // ── Custom Tab Bar ────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
  },
  iconPill: {
    width: 44,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  iconPillActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontFamily: "Inter_700Bold",
  },
});

export default AppNavigator;
