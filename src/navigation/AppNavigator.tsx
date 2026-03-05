import React from "react";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { View, Text, StyleSheet, Platform } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import AddSpendingScreen from "../screens/AddSpendingScreen";
import RepayToCardScreen from "../screens/RepayToCardScreen";
import BestFitCardScreen from "../screens/BestFitCardScreen";
import ShowReportScreen from "../screens/ShowReportScreen";
import MoneyOwedScreen from "../screens/MoneyOwedScreen";
import YourCardsScreen from "../screens/YourCardsScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();

// Custom tab bar icon with label
const TabBarIcon = ({
  iconName,
  label,
  focused,
}: {
  iconName: keyof typeof Feather.glyphMap;
  label: string;
  focused: boolean;
}) => {
  return (
    <View style={styles.tabIconContainer}>
      <Feather
        name={iconName}
        size={20}
        color={focused ? "#1976D2" : "#666666"}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? "#1976D2" : "#666666" },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      tabBarPosition="bottom"
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          elevation: 8,
          shadowOpacity: 0.1,
          height: Platform.OS === "ios" ? 80 : 65,
        },
        tabBarIndicatorStyle: {
          backgroundColor: "#1976D2",
          height: 3,
          top: 0,
        },
        tabBarShowLabel: false,
        swipeEnabled: true,
        animationEnabled: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="home" label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ShowReportScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="file-text" label="Reports" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Money Owed"
        component={MoneyOwedScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon
              iconName="dollar-sign"
              label="Money Owed"
              focused={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Cards"
        component={YourCardsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="credit-card" label="Cards" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIcon iconName="settings" label="Settings" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="AddSpending" component={AddSpendingScreen} />
      <Stack.Screen name="RepayToCard" component={RepayToCardScreen} />
      <Stack.Screen name="BestFitCard" component={BestFitCardScreen} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  tabLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    marginTop: 4,
  },
});

export default AppNavigator;
