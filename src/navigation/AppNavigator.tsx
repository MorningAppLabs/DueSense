import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import AddSpendingScreen from "../screens/AddSpendingScreen";
import RepayToCardScreen from "../screens/RepayToCardScreen";
import BestFitCardScreen from "../screens/BestFitCardScreen";
import ShowReportScreen from "../screens/ShowReportScreen";
import MoneyOwedScreen from "../screens/MoneyOwedScreen";
import YourCardsScreen from "../screens/YourCardsScreen";
import SettingsScreen from "../screens/SettingsScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Feather.glyphMap;
          switch (route.name) {
            case "Home":
              iconName = "home";
              break;
            case "Reports":
              iconName = "file-text";
              break;
            case "Money Owed":
              iconName = "dollar-sign";
              break;
            case "Cards":
              iconName = "credit-card";
              break;
            case "Settings":
              iconName = "settings";
              break;
            default:
              iconName = "circle";
          }
          return <Feather name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#1976D2",
        tabBarInactiveTintColor: "#666666",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          elevation: 8,
          shadowOpacity: 0.1,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_700Bold",
          fontSize: 10,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reports" component={ShowReportScreen} />
      <Tab.Screen name="Money Owed" component={MoneyOwedScreen} />
      <Tab.Screen name="Cards" component={YourCardsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
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

export default AppNavigator;
