import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ProgressBarProps {
  label: string;
  filled: number;
  total: number;
  color: string; // You can keep this prop if you still want a default color or use it for something else, but it's not strictly needed for the dynamic fill color
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  filled,
  total,
  color, // You can still receive this prop
}) => {
  const percentage = total > 0 ? (filled / total) * 100 : 0;

  let filledColor = "#388E3C"; // Default to green (low usage)

  if (percentage > 50 && percentage <= 80) {
    filledColor = "#FBC02D"; // Yellow for medium usage
  } else if (percentage > 80) {
    filledColor = "#D32F2F"; // Red for high usage
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bar}>
        <View
          style={[
            styles.filled,
            { width: `${percentage}%`, backgroundColor: filledColor }, // Use filledColor
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#1A1A1A",
    marginBottom: 4,
  },
  bar: {
    height: 12,
    backgroundColor: "#E0E0E0",
    borderRadius: 6,
    overflow: "hidden",
  },
  filled: {
    height: "100%",
    borderRadius: 6,
  },
});

export default ProgressBar;
