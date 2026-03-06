import React, { useRef } from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from "../theme/theme";

interface ActionButtonProps {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: string;
  subtitle?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  icon,
  color,
  onPress,
  accessibilityLabel,
  subtitle,
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
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

  // Derive a lighter background — use 20% opacity tint (33 in hex)
  const bgStyle = { backgroundColor: color + "33" };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[styles.button, bgStyle]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        <View style={[styles.iconCircle, { backgroundColor: color }]}>
          <Feather name={icon} size={18} color={COLORS.textInverse} />
        </View>
        <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    ...SHADOWS.sm,
  },
  button: {
    flex: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 76,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  label: {
    ...TYPOGRAPHY.captionBold,
    fontSize: 11,
    textAlign: "center",
  },
  subtitle: {
    ...TYPOGRAPHY.micro,
    textAlign: "center",
    marginTop: 1,
  },
});

export default ActionButton;
