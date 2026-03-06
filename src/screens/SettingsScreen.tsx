import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  StatusBar,
  Switch,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as LocalAuthentication from "expo-local-authentication";
import { useStore } from "../store/store";
import { currencies } from "../constants/currencies";
import { changelogs } from "../constants/changelogs";
import { privacyPolicy } from "../constants/privacyPolicy";
import { termsOfUse } from "../constants/termsOfUse";
import { checkForUpdates } from "../utils/updateChecker";
import Dropdown from "../components/Dropdown";
import {
  storeNotificationPreference,
  getNotificationPreference,
} from "../utils/notifications";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from "../theme/theme";

type NotifType = "dueDate" | "owedMoney" | "billEmi" | "subscription";

interface NotifPrefs {
  dueDate: { enabled: boolean; time: Date };
  owedMoney: { enabled: boolean; time: Date };
  billEmi: { enabled: boolean; time: Date };
  subscription: { enabled: boolean; time: Date };
}

const parseTime = (str: string): Date => {
  const [h, m] = str.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 9, m ?? 0, 0, 0);
  return d;
};

const formatTime = (d: Date): string =>
  `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

const NOTIF_LABELS: Record<NotifType, { label: string; icon: string; desc: string }> = {
  dueDate: { label: "Bill Due Reminders", icon: "calendar", desc: "Alert when your card bill is due soon" },
  owedMoney: { label: "Money Owed Reminders", icon: "user", desc: "Alert when someone owes you money" },
  billEmi: { label: "EMI Reminders", icon: "repeat", desc: "Alert for upcoming EMI payments" },
  subscription: { label: "Subscription Reminders", icon: "credit-card", desc: "Alert on your subscription billing dates" },
};

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, cards, transactions, repayments, subscriptions, merchants, categories, persons, setState } = useStore();

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    dueDate: { enabled: true, time: parseTime(settings.notificationTimes.dueDate) },
    owedMoney: { enabled: true, time: parseTime(settings.notificationTimes.owedMoney) },
    billEmi: { enabled: true, time: parseTime(settings.notificationTimes.billEmi) },
    subscription: { enabled: true, time: parseTime(settings.notificationTimes.subscription ?? "09:00") },
  });
  const [timePickerFor, setTimePickerFor] = useState<NotifType | null>(null);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | "changelog" | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Load notification prefs on mount
  useEffect(() => {
    ([
      "dueDate",
      "owedMoney",
      "billEmi",
      "subscription",
    ] as NotifType[]).forEach(async (type) => {
      const p = await getNotificationPreference(type);
      if (p) {
        setNotifPrefs((prev) => ({
          ...prev,
          [type]: { enabled: p.enabled ?? true, time: parseTime(p.time ?? "09:00") },
        }));
      }
    });
  }, []);

  // Check biometric hardware availability
  useEffect(() => {
    (async () => {
      const [hasHw, enrolled] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
      ]);
      setBiometricAvailable(hasHw && enrolled);
    })();
  }, []);

  const toggleNotif = async (type: NotifType) => {
    const updated = { ...notifPrefs[type], enabled: !notifPrefs[type].enabled };
    setNotifPrefs((p) => ({ ...p, [type]: updated }));
    await storeNotificationPreference(type, updated.enabled, formatTime(updated.time));
  };

  const onTimeChange = async (_: any, date?: Date) => {
    if (!timePickerFor) return;
    if (Platform.OS === "android") setTimePickerFor(null);
    if (!date) return;
    const updated = { ...notifPrefs[timePickerFor], time: date };
    setNotifPrefs((p) => ({ ...p, [timePickerFor]: updated }));
    await storeNotificationPreference(timePickerFor, updated.enabled, formatTime(date));
    updateSettings({
      notificationTimes: {
        ...settings.notificationTimes,
        [timePickerFor]: formatTime(date),
      },
    });
  };

  // ── Backup ──
  const handleBackup = async () => {
    try {
      const data = JSON.stringify({ cards, transactions, repayments, subscriptions, merchants, categories, persons, settings }, null, 2);
      const path = (FileSystem.cacheDirectory ?? "") + "DueSense_backup.json";
      await FileSystem.writeAsStringAsync(path, data, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: "Save DueSense Backup" });
      } else {
        Alert.alert("Backup saved", `File saved to: ${path}`);
      }
    } catch (e: any) {
      Alert.alert("Backup failed", e.message);
    }
  };

  // ── Restore ──
  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(content);
      if (!parsed.cards || !parsed.transactions) {
        return Alert.alert("Invalid File", "This doesn't look like a valid DueSense backup.");
      }
      Alert.alert(
        "Restore Backup?",
        `This will replace all your current data with the backup from ${file.name}.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            style: "destructive",
            onPress: () => {
              setState({
                cards: parsed.cards ?? [],
                transactions: parsed.transactions ?? [],
                repayments: parsed.repayments ?? [],
                subscriptions: parsed.subscriptions ?? [],
                merchants: parsed.merchants ?? [],
                categories: parsed.categories ?? [],
                persons: parsed.persons ?? [],
                settings: parsed.settings ?? settings,
              });
              Alert.alert("Restored", "Your data has been restored successfully.");
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Restore failed", e.message);
    }
  };

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    try {
      await checkForUpdates(false);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleBugReport = () => {
    const version = Constants.expoConfig?.version ?? "1.0.0";
    const os = Platform.OS === "android" ? `Android ${Platform.Version}` : `iOS ${Platform.Version}`;
    const subject = encodeURIComponent(`[DueSense v${version}] Bug Report / Feature Request`);
    const body = encodeURIComponent(
      `App Version: DueSense v${version}\nPlatform: ${os}\n\n--- Describe the issue or feature request below ---\n\n`
    );
    Linking.openURL(`mailto:morningapplabs@gmail.com?subject=${subject}&body=${body}`);
  };

  const SettingRow = ({
    icon,
    label,
    desc,
    right,
    onPress,
    danger,
  }: {
    icon: string;
    label: string;
    desc?: string;
    right?: React.ReactNode;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={[styles.settingIcon, { backgroundColor: (danger ? COLORS.dangerLight : COLORS.primaryLight) }]}>
        <Feather name={icon as any} size={16} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.settingLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {desc ? <Text style={styles.settingDesc}>{desc}</Text> : null}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={16} color={COLORS.textMuted} /> : null)}
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const legalContent = () => {
    switch (legalModal) {
      case "privacy": return { title: "Privacy Policy", body: privacyPolicy, isLog: false };
      case "terms": return { title: "Terms of Use", body: termsOfUse, isLog: false };
      case "changelog": return { title: "Changelog", body: null, isLog: true };
      default: return { title: "", body: "", isLog: false };
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.topBar}>
        <Text style={styles.screenTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Preferences ── */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIcon, { backgroundColor: COLORS.primaryLight }]}>
              <Feather name="dollar-sign" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.settingLabel}>Currency</Text>
              <Text style={styles.settingDesc}>Displayed throughout the app</Text>
              <Dropdown
                items={currencies.map((c) => ({ label: c.label, value: c.value }))}
                selectedValue={settings.currency}
                onValueChange={(v) => updateSettings({ currency: v })}
                placeholder="Select currency…"
                label="Select Currency"
                description="Choose your preferred display currency"
                searchable
                style={{ marginTop: 4 }}
              />
            </View>
          </View>
        </View>

        {/* ── Notifications ── */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          {(Object.keys(NOTIF_LABELS) as NotifType[]).map((type, i) => {
            const info = NOTIF_LABELS[type];
            const pref = notifPrefs[type];
            return (
              <View key={type}>
                {i > 0 && <View style={styles.divider} />}
                <View style={styles.notifRow}>
                  <View style={[styles.settingIcon, { backgroundColor: COLORS.primaryLight }]}>
                    <Feather name={info.icon as any} size={16} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>{info.label}</Text>
                    <Text style={styles.settingDesc}>{info.desc}</Text>
                    {pref.enabled && (
                      <TouchableOpacity
                        style={styles.timeBtn}
                        onPress={() => setTimePickerFor(type)}
                      >
                        <Feather name="clock" size={12} color={COLORS.primary} />
                        <Text style={styles.timeTxt}>{formatTime(pref.time)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Switch
                    value={pref.enabled}
                    onValueChange={() => toggleNotif(type)}
                    trackColor={{ false: COLORS.borderLight, true: COLORS.primaryLight }}
                    thumbColor={pref.enabled ? COLORS.primary : COLORS.textMuted}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Security ── */}
        {biometricAvailable && (
          <>
            <SectionHeader title="Security" />
            <View style={styles.card}>
              <SettingRow
                icon="shield"
                label="Biometric Lock"
                desc="Require fingerprint or face ID to open the app"
                right={
                  <Switch
                    value={settings.biometricEnabled ?? false}
                    onValueChange={(val) => updateSettings({ biometricEnabled: val })}
                    trackColor={{ false: COLORS.borderLight, true: COLORS.primaryLight }}
                    thumbColor={(settings.biometricEnabled ?? false) ? COLORS.primary : COLORS.textMuted}
                  />
                }
              />
            </View>
          </>
        )}

        {/* ── Backup & Restore ── */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <SettingRow
            icon="download"
            label="Backup Data"
            desc="Save all your data to a JSON file"
            onPress={handleBackup}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="upload"
            label="Restore from Backup"
            desc="Restore data from a previous backup file"
            onPress={handleRestore}
            danger
          />
        </View>

        {/* ── Legal ── */}
        <SectionHeader title="Legal" />
        <View style={styles.card}>
          <SettingRow icon="lock" label="Privacy Policy" desc="How we handle your data" onPress={() => setLegalModal("privacy")} />
          <View style={styles.divider} />
          <SettingRow icon="file-text" label="Terms of Use" desc="Rules for using DueSense" onPress={() => setLegalModal("terms")} />
          <View style={styles.divider} />
          <SettingRow icon="list" label="Changelog" desc="What’s new in each version" onPress={() => setLegalModal("changelog")} />
        </View>

        {/* ── Support ── */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <SettingRow
            icon="mail"
            label="Bug Report / Feature Request"
            desc="Report a bug or suggest a new feature"
            onPress={handleBugReport}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="coffee"
            label="Buy Me a Coffee"
            desc="Support the development of DueSense ☕"
            onPress={() => Linking.openURL("https://buymeacoffee.com/morningapplabs")}
          />
        </View>

        {/* ── App Info ── */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingRow
            icon="info"
            label="App Version"
            desc={`DueSense v${Constants.expoConfig?.version ?? "1.0.0"}`}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="refresh-cw"
            label={checkingUpdate ? "Checking for updates…" : "Check for Updates"}
            desc="Tap to check if a newer version is available"
            onPress={handleCheckUpdate}
          />
        </View>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>

      {/* ── Time Picker ── */}
      {timePickerFor !== null && (
        <DateTimePicker
          value={notifPrefs[timePickerFor].time}
          mode="time"
          is24Hour
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
        />
      )}

      {/* ── Legal Modal ── */}
      <Modal visible={legalModal !== null} animationType="slide" transparent onRequestClose={() => setLegalModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxHeight: "88%" }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{legalContent().title}</Text>
              <TouchableOpacity onPress={() => setLegalModal(null)}>
                <Feather name="x" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {legalContent().isLog ? (
                changelogs.map((entry, i) => (
                  <View key={i} style={styles.changelogEntry}>
                    <Text style={styles.changelogVersion}>v{entry.version} · {entry.date}</Text>
                    <Text style={styles.legalText}>{entry.description}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.legalText}>{legalContent().body}</Text>
              )}
              <View style={{ height: SPACING.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  screenTitle: { ...TYPOGRAPHY.h2 },
  container: { padding: SPACING.md },

  sectionHeader: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xs,
    overflow: "hidden",
    ...SHADOWS.sm,
  },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 52 },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  settingLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  settingDesc: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 1 },

  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  timeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  timeTxt: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: "700" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    marginBottom: SPACING.sm,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { ...TYPOGRAPHY.h3 },
  pickerWrap: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  legalText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  changelogEntry: {
    marginBottom: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    paddingLeft: SPACING.sm,
  },
  changelogVersion: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
});

export default SettingsScreen;

