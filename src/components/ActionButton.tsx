import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

interface ActionButtonProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  color,
  onPress,
  accessibilityLabel,
  accessibilityRole,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: color },
        { transform: [{ scale }] },
      ]}
    >
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={label}
        accessibilityRole={"button"}
      >
        <Feather name={icon} size={20} color="#FFFFFF" />
        <Text style={styles.label}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 100, // Minimum width to prevent shrinking too much
    maxWidth: (width - 28 - 8) / 3, // Screen width - padding - gaps
    height: 80,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 2, // Reduced for tighter spacing
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  button: {
    flex: 1,
    flexDirection: "column", // Align icon and text horizontally
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  label: {
    fontFamily: "Inter_700Bold",
    fontSize: 14, // Reduced to prevent wrapping
    color: "#FFFFFF",
    //marginLeft: 6, // Space between icon and text
    flexShrink: 1, // Allow text to shrink if needed
    marginTop: 4, // Add vertical margin
    textAlign: "center",
  },
});

export default ActionButton;
