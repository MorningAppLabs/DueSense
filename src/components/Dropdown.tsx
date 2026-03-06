/**
 * Dropdown – a custom modal-based picker that replaces @react-native-picker/picker.
 * Completely avoids the "overflow:hidden clips the dropdown" issue by using a Modal.
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from "../theme/theme";

export interface DropdownItem {
  label: string;
  value: string;
}

interface DropdownProps {
  items: DropdownItem[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  /** Description shown below the label in the modal header */
  description?: string;
  searchable?: boolean;
  style?: object;
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({
  items,
  selectedValue,
  onValueChange,
  placeholder = "Select…",
  label,
  description,
  searchable = false,
  style,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(
    () => items.find((i) => i.value === selectedValue)?.label ?? placeholder,
    [items, selectedValue, placeholder]
  );

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(q));
  }, [items, query, searchable]);

  const handleSelect = (value: string) => {
    onValueChange(value);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      {/* Trigger */}
      <TouchableOpacity
        style={[styles.trigger, disabled && styles.triggerDisabled, style]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.75}
      >
        <Text
          style={[
            styles.triggerTxt,
            !selectedValue && styles.placeholderTxt,
          ]}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Feather
          name="chevron-down"
          size={16}
          color={disabled ? COLORS.textMuted : COLORS.textSecondary}
        />
      </TouchableOpacity>

      {/* Modal picker */}
      <Modal
        visible={open}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => { setOpen(false); setQuery(""); }}
      >
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdropTouch} onPress={() => { setOpen(false); setQuery(""); }} />
          <View style={styles.sheet}>
            {/* Handle bar */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
                {description ? <Text style={styles.sheetDesc}>{description}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => { setOpen(false); setQuery(""); }}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            {searchable && (
              <View style={styles.searchRow}>
                <Feather name="search" size={16} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search…"
                  placeholderTextColor={COLORS.textMuted}
                  autoFocus
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => setQuery("")}>
                    <Feather name="x-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Options list */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.label}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === selectedValue;
                return (
                  <TouchableOpacity
                    style={[styles.option, isSelected && styles.optionSelected]}
                    onPress={() => handleSelect(item.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionTxt, isSelected && styles.optionTxtSelected]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Feather name="check" size={16} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyTxt}>No options found</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? SPACING.sm + 4 : SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
    minHeight: 48,
    ...SHADOWS.xs,
  },
  triggerDisabled: {
    backgroundColor: COLORS.borderLight,
    opacity: 0.7,
  },
  triggerTxt: {
    ...TYPOGRAPHY.body,
    flex: 1,
  },
  placeholderTxt: {
    color: COLORS.textMuted,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl + 8,
    maxHeight: "70%",
    ...SHADOWS.lg,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  sheetTitle: {
    ...TYPOGRAPHY.h3,
  },
  sheetDesc: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    ...TYPOGRAPHY.body,
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },

  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  optionSelected: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    borderBottomColor: "transparent",
    marginHorizontal: -SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  optionTxt: {
    ...TYPOGRAPHY.body,
    flex: 1,
  },
  optionTxtSelected: {
    color: COLORS.primary,
    fontFamily: "Inter_700Bold",
  },
  emptyRow: {
    padding: SPACING.xl,
    alignItems: "center",
  },
  emptyTxt: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
  },
});

export default Dropdown;
