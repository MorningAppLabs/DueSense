import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ProgressBarProps {
  label: string;
  filled: number;
  total: number;
  color: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  filled,
  total,
  color,
}) => {
  const percentage = total > 0 ? (filled / total) * 100 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.bar}>
        <View
          style={[
            styles.filled,
            { width: `${percentage}%`, backgroundColor: color },
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
