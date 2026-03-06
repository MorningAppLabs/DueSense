import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from "../theme/theme";

interface ProgressBarProps {
  label: string;
  filled: number;
  total: number;
  color?: string;
  showPercentage?: boolean;
  height?: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  filled,
  total,
  color,
  showPercentage = false,
  height = 8,
}) => {
  const safeTotal = total > 0 ? total : 1;
  const percentage = Math.min(100, (filled / safeTotal) * 100);

  // Dynamic color if none provided
  let barColor = color ?? COLORS.success;
  if (!color) {
    if (percentage > 80) barColor = COLORS.danger;
    else if (percentage > 50) barColor = COLORS.warning;
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showPercentage && (
          <Text style={[styles.pct, { color: barColor }]}>
            {percentage.toFixed(0)}%
          </Text>
        )}
      </View>
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            { width: `${percentage}%`, backgroundColor: barColor, height },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  pct: {
    ...TYPOGRAPHY.captionBold,
  },
  track: {
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  fill: {
    borderRadius: RADIUS.full,
  },
});

export default ProgressBar;

