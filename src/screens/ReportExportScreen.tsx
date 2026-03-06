import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import moment from "moment";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useStore } from "../store/store";
import { Card, Transaction } from "../types/types";
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS, getCardColor } from "../theme/theme";
import Constants from "expo-constants";

type RootStackParamList = { ReportExport: undefined };
type NavProp = NativeStackNavigationProp<RootStackParamList>;

type RangePreset = "current_month" | "last_3" | "last_6" | "this_year" | "all";

const RANGE_OPTIONS: { key: RangePreset; label: string }[] = [
  { key: "current_month", label: "This Month" },
  { key: "last_3",        label: "Last 3 Months" },
  { key: "last_6",        label: "Last 6 Months" },
  { key: "this_year",     label: "This Year" },
  { key: "all",           label: "All Time" },
];

const escapeHtml = (str: string): string =>
  (str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmt = (amt: number, sym: string) =>
  `${sym}${amt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─────────────────────────────────────────────────────────────────────────────

const ReportExportScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const { cards, transactions, settings, persons } = useStore();

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(cards.map((c: Card) => c.id));
  const [rangePreset, setRangePreset] = useState<RangePreset>("current_month");
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [showCashback, setShowCashback] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [generating, setGenerating] = useState(false);

  const toggleCard = (id: string) =>
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAllCards = () => setSelectedCardIds(cards.map((c: Card) => c.id));
  const clearAllCards  = () => setSelectedCardIds([]);

  const { startDate, endDate, rangeLabel } = useMemo(() => {
    const end = moment().endOf("day");
    switch (rangePreset) {
      case "current_month":
        return {
          startDate: moment().startOf("month"),
          endDate: end,
          rangeLabel: `${moment().format("MMMM YYYY")} (Current Month)`,
        };
      case "last_3":
        return {
          startDate: moment().subtract(3, "months").startOf("day"),
          endDate: end,
          rangeLabel: `Last 3 Months (${moment().subtract(3, "months").format("MMM YYYY")} – ${moment().format("MMM YYYY")})`,
        };
      case "last_6":
        return {
          startDate: moment().subtract(6, "months").startOf("day"),
          endDate: end,
          rangeLabel: `Last 6 Months (${moment().subtract(6, "months").format("MMM YYYY")} – ${moment().format("MMM YYYY")})`,
        };
      case "this_year":
        return {
          startDate: moment().startOf("year"),
          endDate: end,
          rangeLabel: `Year ${moment().format("YYYY")}`,
        };
      case "all":
      default:
        return { startDate: moment("2020-01-01"), endDate: end, rangeLabel: "All Time" };
    }
  }, [rangePreset]);

  const filteredTxs = useMemo(() => {
    return transactions.filter((t: Transaction) => {
      if (!selectedCardIds.includes(t.cardId)) return false;
      if (!moment(t.date, "YYYY-MM-DD").isBetween(startDate, endDate, undefined, "[]")) return false;
      if (personFilter !== "all") {
        if (personFilter === "__self__") {
          if (t.forWhom !== "Myself") return false;
        } else {
          if (t.personName !== personFilter) return false;
        }
      }
      return true;
    });
  }, [transactions, selectedCardIds, startDate, endDate, personFilter]);

  const previewStats = useMemo(() => {
    const total = filteredTxs.reduce((s: number, t: Transaction) => s + t.amount, 0);
    const cashback = filteredTxs.reduce((s: number, t: Transaction) => s + (t.cashback ?? 0), 0);
    return { total, cashback, count: filteredTxs.length };
  }, [filteredTxs]);

  const generateHTML = useCallback((): string => {
    const sym = settings.currency;
    const generatedAt = moment().format("DD MMM YYYY, hh:mm A");
    const appVersion = Constants.expoConfig?.version ?? "1.0.0";

    // Category breakdown
    const catMap: Record<string, number> = {};
    filteredTxs.forEach((t: Transaction) => {
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount;
    });
    const grandTotal = filteredTxs.reduce((s: number, t: Transaction) => s + t.amount, 0);
    const grandCashback = filteredTxs.reduce((s: number, t: Transaction) => s + (t.cashback ?? 0), 0);

    const catRows = Object.entries(catMap)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amt]) =>
        `<tr>
          <td>${escapeHtml(cat)}</td>
          <td class="amt">${fmt(amt, sym)}</td>
          <td class="pct">${grandTotal > 0 ? ((amt / grandTotal) * 100).toFixed(1) : "0"}%</td>
        </tr>`
      ).join("");

    // Per-card sections
    const cardSections = selectedCardIds
      .map((id) => {
        const card = cards.find((c: Card) => c.id === id);
        if (!card) return "";
        const cardTxs = filteredTxs
          .filter((t: Transaction) => t.cardId === id)
          .sort((a: Transaction, b: Transaction) => moment(b.date).diff(moment(a.date)));
        const cardTotal = cardTxs.reduce((s: number, t: Transaction) => s + t.amount, 0);
        const cardCashback = cardTxs.reduce((s: number, t: Transaction) => s + (t.cashback ?? 0), 0);
        const hasPersonCol = cardTxs.some((t: Transaction) => t.forWhom === "Someone Else");

        const txRows = cardTxs.map((t: Transaction) => {
          const repaidBadge = t.forWhom === "Someone Else"
            ? `<span class="${t.repaid ? "badge-repaid" : "badge-pending"}">${t.repaid ? "Repaid" : "Pending"}</span>`
            : "";
          return `<tr>
            <td class="date-cell">${moment(t.date, "YYYY-MM-DD").format("DD MMM YYYY")}</td>
            <td><strong>${escapeHtml(t.merchant || "—")}</strong>${showNotes && t.description ? `<br><span class="note">${escapeHtml(t.description)}</span>` : ""}</td>
            <td class="cat-cell">${escapeHtml(t.category)}</td>
            ${hasPersonCol ? `<td>${t.forWhom === "Someone Else" ? `${escapeHtml(t.personName ?? "—")} ${repaidBadge}` : "<span class='self-badge'>Self</span>"}</td>` : ""}
            <td class="amt">${fmt(t.amount, sym)}</td>
            ${showCashback ? `<td class="cashback">${t.cashback && t.cashback > 0 ? `+${fmt(t.cashback, sym)}` : "—"}</td>` : ""}
          </tr>`;
        }).join("");

        const personTh = hasPersonCol ? "<th>Person</th>" : "";
        const cashbackTh = showCashback ? "<th class='amt'>Cashback</th>" : "";

        const cardIdx = cards.findIndex((c: Card) => c.id === id);
        const cardHexColor = getCardColor(cardIdx, card.color);

        return `
          <div class="card-block">
            <div class="card-header" style="border-left: 5px solid ${cardHexColor}">
              <div class="card-header-left">
                <span class="card-name">${escapeHtml(card.name)}${card.lastFourDigits ? ` &nbsp;···· ${card.lastFourDigits}` : ""}</span>
                <span class="card-count">${cardTxs.length} transaction${cardTxs.length !== 1 ? "s" : ""}</span>
              </div>
              <div class="card-header-right">
                <span class="stat-item">Spent: <strong>${fmt(cardTotal, sym)}</strong></span>
                ${showCashback ? `<span class="stat-item cashback-stat">Cashback: <strong>+${fmt(cardCashback, sym)}</strong></span>` : ""}
              </div>
            </div>
            ${cardTxs.length === 0
              ? '<p class="no-data">No transactions in this period.</p>'
              : `<table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Merchant / Notes</th>
                      <th>Category</th>
                      ${personTh}
                      <th class="amt">Amount</th>
                      ${cashbackTh}
                    </tr>
                  </thead>
                  <tbody>${txRows}</tbody>
                </table>`
            }
          </div>`;
      }).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1A1A2E;
      background: #fff;
      padding: 20px 24px;
      font-size: 12px;
      line-height: 1.5;
    }

    /* ── Header ── */
    .report-header {
      background: linear-gradient(135deg, #6C63FF 0%, #4A43C8 100%);
      color: #fff;
      padding: 28px 28px 24px;
      border-radius: 14px;
      margin-bottom: 24px;
    }
    .report-header h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.4px; }
    .header-meta {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 12px;
      opacity: 0.88;
    }

    /* ── Summary ── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 28px;
    }
    .summary-box {
      background: #F4F5FB;
      border-radius: 10px;
      padding: 18px 14px;
      text-align: center;
    }
    .summary-val {
      font-size: 22px;
      font-weight: 700;
      color: #6C63FF;
      white-space: nowrap;
    }
    .summary-val.green { color: #22C55E; }
    .summary-lbl {
      font-size: 10px;
      color: #8898AA;
      margin-top: 5px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    /* ── Section titles ── */
    .section-title {
      font-size: 13px;
      font-weight: 700;
      color: #1A1A2E;
      border-bottom: 2px solid #EEF2FF;
      padding-bottom: 8px;
      margin-bottom: 14px;
      margin-top: 28px;
    }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th {
      background: #EEF2FF;
      padding: 9px 12px;
      text-align: left;
      font-weight: 700;
      color: #5A54D4;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 9px 12px;
      border-bottom: 1px solid #F4F5FB;
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #FAFBFF; }
    .amt { text-align: right; font-weight: 600; white-space: nowrap; }
    .cashback { text-align: right; color: #22C55E; font-weight: 600; white-space: nowrap; }
    .pct { text-align: right; color: #8898AA; }
    .date-cell { white-space: nowrap; color: #5A54D4; font-weight: 600; }
    .cat-cell { color: #4B4B60; }
    .note { color: #8898AA; font-size: 10px; font-style: italic; }

    /* ── Card blocks ── */
    .card-block {
      margin-bottom: 28px;
      border: 1px solid #E8EAED;
      border-radius: 12px;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #F8F9FC;
      border-bottom: 1px solid #E8EAED;
      flex-wrap: wrap;
      gap: 8px;
    }
    .card-header-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .card-name { font-size: 14px; font-weight: 700; color: #1A1A2E; }
    .card-count { font-size: 10px; color: #8898AA; }
    .card-header-right {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #4B4B60;
    }
    .cashback-stat { color: #22C55E; }

    /* ── Badges ── */
    .badge-repaid {
      display: inline-block;
      background: #DCFCE7;
      color: #16A34A;
      padding: 1px 7px;
      border-radius: 99px;
      font-size: 9px;
      font-weight: 700;
      margin-left: 4px;
      vertical-align: middle;
    }
    .badge-pending {
      display: inline-block;
      background: #FEF3C7;
      color: #D97706;
      padding: 1px 7px;
      border-radius: 99px;
      font-size: 9px;
      font-weight: 700;
      margin-left: 4px;
      vertical-align: middle;
    }
    .self-badge {
      display: inline-block;
      background: #EEF2FF;
      color: #6C63FF;
      padding: 1px 7px;
      border-radius: 99px;
      font-size: 9px;
      font-weight: 600;
    }
    .stat-item { font-size: 12px; }
    .no-data {
      padding: 20px;
      text-align: center;
      color: #8898AA;
      font-style: italic;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      color: #8898AA;
      font-size: 10px;
      margin-top: 36px;
      border-top: 1px solid #E8EAED;
      padding-top: 16px;
    }

    @media print {
      body { padding: 0; }
      .card-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <div class="report-header">
    <h1>DueSense — Spending Report</h1>
    <div class="header-meta">
      <span>Period: ${escapeHtml(rangeLabel)}</span>
      <span>Generated: ${generatedAt}</span>
      ${personFilter !== "all" ? `<span>Person: ${personFilter === "__self__" ? "Self only" : escapeHtml(personFilter)}</span>` : ""}
      <span>Cards: ${selectedCardIds.length} selected</span>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-box">
      <div class="summary-val">${fmt(grandTotal, sym)}</div>
      <div class="summary-lbl">Total Spending</div>
    </div>
    <div class="summary-box">
      <div class="summary-val green">${fmt(grandCashback, sym)}</div>
      <div class="summary-lbl">Total Cashback</div>
    </div>
    <div class="summary-box">
      <div class="summary-val">${filteredTxs.length}</div>
      <div class="summary-lbl">Transactions</div>
    </div>
  </div>

  ${Object.keys(catMap).length > 0 ? `
  <div class="section-title">Spending by Category</div>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th class="amt">Amount</th>
        <th class="pct">Share</th>
      </tr>
    </thead>
    <tbody>${catRows}</tbody>
  </table>
  ` : ""}

  <div class="section-title">Transactions by Card</div>
  ${cardSections}

  <div class="footer">
    DueSense v${appVersion} &nbsp;·&nbsp; MorningAppLabs &nbsp;·&nbsp; morningapplabs@gmail.com
  </div>

</body>
</html>`;
  }, [
    filteredTxs, selectedCardIds, cards, settings, rangeLabel, personFilter,
    showCashback, showNotes,
  ]);

  const handleGenerate = async () => {
    if (selectedCardIds.length === 0) {
      Alert.alert("No Cards Selected", "Please select at least one card.");
      return;
    }
    setGenerating(true);
    try {
      const html = generateHTML();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Share DueSense Report",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Saved", `Report saved to: ${uri}`);
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const Chip = ({
    label,
    active,
    onPress,
    color,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
    color?: string;
  }) => (
    <TouchableOpacity
      style={[styles.chip, active && { backgroundColor: color ?? COLORS.primary, borderColor: color ?? COLORS.primary }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipTxt, active && { color: COLORS.textInverse }]}>{label}</Text>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  const allPersonOptions = ["all", "__self__", ...persons] as string[];
  const personLabel = (p: string) => {
    if (p === "all") return "All";
    if (p === "__self__") return "Self only";
    return p;
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>Export PDF Report</Text>
          <Text style={styles.screenSub}>Generate a detailed spending report</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Card Selection ── */}
        <SectionHeader title="Select Cards" />
        <View style={styles.card}>
          <View style={styles.selectAllRow}>
            <Text style={styles.selectionHint}>
              {selectedCardIds.length} of {cards.length} selected
            </Text>
            <View style={{ flexDirection: "row", gap: SPACING.xs }}>
              <TouchableOpacity onPress={selectAllCards} style={styles.smallBtn}>
                <Text style={styles.smallBtnTxt}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAllCards} style={[styles.smallBtn, { backgroundColor: COLORS.dangerLight }]}>
                <Text style={[styles.smallBtnTxt, { color: COLORS.danger }]}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
          {cards.length === 0 ? (
            <Text style={styles.hintTxt}>No cards added yet.</Text>
          ) : (
            cards.map((card: Card, idx: number) => {
              const c = getCardColor(idx, card.color);
              const selected = selectedCardIds.includes(card.id);
              return (
                <TouchableOpacity
                  key={card.id}
                  style={[styles.cardRow, selected && { backgroundColor: COLORS.primaryLight }]}
                  onPress={() => toggleCard(card.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.cardDot, { backgroundColor: c }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardRowName}>{card.name}</Text>
                    {card.lastFourDigits ? (
                      <Text style={styles.cardRowSub}>···· {card.lastFourDigits}</Text>
                    ) : null}
                  </View>
                  <View style={[styles.checkbox, selected && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                    {selected && <Feather name="check" size={12} color={COLORS.textInverse} />}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Date Range ── */}
        <SectionHeader title="Date Range" />
        <View style={styles.card}>
          <View style={styles.chipRow}>
            {RANGE_OPTIONS.map((r) => (
              <Chip
                key={r.key}
                label={r.label}
                active={rangePreset === r.key}
                onPress={() => setRangePreset(r.key)}
              />
            ))}
          </View>
        </View>

        {/* ── Person Filter ── */}
        {persons.length > 0 && (
          <>
            <SectionHeader title="Person Filter" />
            <View style={styles.card}>
              <View style={styles.chipRow}>
                {allPersonOptions.map((p) => (
                  <Chip
                    key={p}
                    label={personLabel(p)}
                    active={personFilter === p}
                    onPress={() => setPersonFilter(p)}
                    color={COLORS.info}
                  />
                ))}
              </View>
            </View>
          </>
        )}

        {/* ── Report Options ── */}
        <SectionHeader title="Report Options" />
        <View style={styles.card}>
          <View style={styles.optionRow}>
            <View>
              <Text style={styles.optionLabel}>Show Cashback</Text>
              <Text style={styles.optionDesc}>Include cashback column in transactions table</Text>
            </View>
            <Switch
              value={showCashback}
              onValueChange={setShowCashback}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primaryLight }}
              thumbColor={showCashback ? COLORS.primary : COLORS.textMuted}
            />
          </View>
          <View style={[styles.divider, { marginLeft: 0 }]} />
          <View style={styles.optionRow}>
            <View>
              <Text style={styles.optionLabel}>Show Transaction Notes</Text>
              <Text style={styles.optionDesc}>Show description/notes below merchant name</Text>
            </View>
            <Switch
              value={showNotes}
              onValueChange={setShowNotes}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primaryLight }}
              thumbColor={showNotes ? COLORS.primary : COLORS.textMuted}
            />
          </View>
        </View>

        {/* ── Preview Stats ── */}
        <SectionHeader title="Report Preview" />
        <View style={[styles.card, styles.previewCard]}>
          <View style={styles.previewStat}>
            <Feather name="credit-card" size={18} color={COLORS.primary} />
            <Text style={styles.previewVal}>{selectedCardIds.length}</Text>
            <Text style={styles.previewLbl}>Cards</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStat}>
            <Feather name="list" size={18} color={COLORS.primary} />
            <Text style={styles.previewVal}>{previewStats.count}</Text>
            <Text style={styles.previewLbl}>Transactions</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStat}>
            <Feather name="trending-down" size={18} color={COLORS.danger} />
            <Text style={[styles.previewVal, { color: COLORS.danger }]}>
              {settings.currency}{previewStats.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.previewLbl}>Total Spend</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStat}>
            <Feather name="trending-up" size={18} color={COLORS.success} />
            <Text style={[styles.previewVal, { color: COLORS.success }]}>
              {settings.currency}{previewStats.cashback.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </Text>
            <Text style={styles.previewLbl}>Cashback</Text>
          </View>
        </View>

        {/* ── Generate Button ── */}
        <TouchableOpacity
          style={[styles.generateBtn, (generating || selectedCardIds.length === 0) && { opacity: 0.6 }]}
          onPress={handleGenerate}
          disabled={generating || selectedCardIds.length === 0}
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator size="small" color={COLORS.textInverse} />
          ) : (
            <Feather name="file-text" size={20} color={COLORS.textInverse} />
          )}
          <Text style={styles.generateBtnTxt}>
            {generating ? "Generating PDF…" : "Generate & Share PDF"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          PDF will open a share sheet so you can save or send the report.
        </Text>

        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOWS.xs,
  },
  screenTitle: { ...TYPOGRAPHY.h3 },
  screenSub: { ...TYPOGRAPHY.caption, marginTop: 1 },

  container: { padding: SPACING.md },

  sectionTitle: {
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
    padding: SPACING.md,
    marginBottom: SPACING.xs,
    ...SHADOWS.sm,
  },

  selectAllRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  selectionHint: { ...TYPOGRAPHY.caption, color: COLORS.textMuted },
  smallBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  smallBtnTxt: { ...TYPOGRAPHY.caption, color: COLORS.primary, fontWeight: "700" },

  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  cardDot: { width: 12, height: 12, borderRadius: 6, flexShrink: 0 },
  cardRowName: { ...TYPOGRAPHY.bodyBold, fontSize: 13 },
  cardRowSub: { ...TYPOGRAPHY.micro, color: COLORS.textMuted },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  chip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    marginBottom: 2,
  },
  chipTxt: { ...TYPOGRAPHY.caption },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
    gap: SPACING.md,
  },
  optionLabel: { ...TYPOGRAPHY.bodyBold, fontSize: 14 },
  optionDesc: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, marginTop: 1, maxWidth: 200 },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginVertical: SPACING.xs },

  previewCard: { padding: 0, flexDirection: "row", overflow: "hidden" },
  previewStat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACING.md,
    gap: 4,
  },
  previewDivider: { width: 1, backgroundColor: COLORS.borderLight },
  previewVal: { ...TYPOGRAPHY.h4, fontSize: 14 },
  previewLbl: { ...TYPOGRAPHY.micro, color: COLORS.textMuted, textAlign: "center" },

  generateBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  generateBtnTxt: { ...TYPOGRAPHY.bodyBold, color: COLORS.textInverse, fontSize: 16 },

  footerNote: {
    ...TYPOGRAPHY.micro,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.sm,
  },

  hintTxt: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: "center", padding: SPACING.md },
});

export default ReportExportScreen;
