# DueSense — Smart Credit Card Manager

<p align="center">
  <img src="assets/icon.png" alt="DueSense Logo" width="120" />
</p>

<p align="center">
  <strong>Take control of every rupee on your credit cards.</strong><br />
  Track spending, earn cashback insights, manage EMIs, get due-date alerts, and never let a bill surprise you.
</p>

<p align="center">
  <a href="https://github.com/MorningAppLabs/DueSense/releases"><img src="https://img.shields.io/github/v/release/MorningAppLabs/DueSense?label=Latest%20Release&color=4361EE" /></a>
  <img src="https://img.shields.io/badge/Platform-Android-brightgreen" />
  <img src="https://img.shields.io/badge/Built%20with-Expo%20SDK%2054-blueviolet" />
  <img src="https://img.shields.io/badge/License-MIT-blue" />
</p>

---

## ✨ Features

### 💳 Card Management
- Add unlimited credit cards with custom billing cycles, credit limits, and due dates
- Color-coded cards with bank network badges (Visa, Mastercard, RuPay, Amex, Diners)
- Annual fee tracking with due-date alerts (30-day advance warning)
- **Annual fee waiver threshold** — track how much more you need to spend to waive the fee
- Progress bar for credit utilization at a glance

### 💸 Spending Tracker
- Log transactions in 3 guided steps: Card + Amount → Merchant + Category → For Whom
- 10 built-in categories with icons; create custom categories with your own name and chosen icon
- Category icon picker (35 Feather icon options) when adding a custom category
- Currency prefix display on the amount input
- Full Payment or EMI modes (with months and interest rate)
- Online / Offline spend classification

### 🤑 Cashback Engine
- Per-card cashback rules: merchant-specific %, category %, online/offline splits
- Real-time cashback estimate as you type a transaction
- Cumulative cashback tracking per card and overall

### 📊 Reports
- Billing cycle selector per card (current, past cycles)
- Searchable transaction list (merchant, description, category)
- Spent / Unbilled / Cashback / Transaction count summary
- Inline transaction editing with full field support (merchant, category, amount)
- Delete transactions with confirmation
- **Export PDF Report** — multi-card, date-range, person-filtered PDF with cashback and notes columns

### 👥 Money Owed
- Track all "paid for someone else" transactions, grouped by person
- One-tap beautiful payment reminder via WhatsApp, Telegram, or Email
- Formatted message with per-transaction breakdown, total due, and emoji styling
- Mark individual transactions as repaid

### 🔁 Subscriptions
- Track recurring subscriptions (Monthly / Quarterly / Yearly / Weekly)
- Supports Card, UPI, PayPal, Other payment methods
- 12 built-in categories (Streaming, Gaming, Music, Software, Cloud, etc.) with icons
- Custom category with icon picker when "Others" is selected
- Active subscription count, monthly cost summary, and "due this week" alerts
- Pause/reactivate individual subscriptions

### 🔍 Best Fit Card
- Analyzes all your cards' cashback rules for any merchant + category + payment type combination
- Ranks cards from best to worst cashback offer
- Shows reasons for each card's ranking

### 🔢 Repayment Tracker
- Log repayments against bills per card and cycle
- Running balance of how much is still unbilled vs repaid

### 🔔 Notifications
- Due-date reminders (configurable time)
- Money-owed reminders
- EMI reminders
- **Subscription billing-date reminders** — fires on each subscription's next billing date
- Per-type toggle + custom notification time via Settings

### ⚙️ Settings
- Currency selector (35+ supported currencies)
- Biometric lock (fingerprint / face)
- Data backup and restore (JSON export/import)
- Over-the-air updates (EAS Updates) — silent background patching
- Manual update check from GitHub Releases (APK)
- Dark system status bar, edge-to-edge on Android

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 (New Architecture enabled) |
| Language | TypeScript |
| Navigation | React Navigation 7 (Stack + Bottom Tabs, fully custom tab bar) |
| State | Zustand + AsyncStorage (100% local, no cloud) |
| UI | Custom design system (`theme/theme.ts`) with Inter font |
| Notifications | expo-notifications |
| OTA Updates | expo-updates (EAS Updates) |
| Biometric Auth | expo-local-authentication |
| Build System | EAS Build |
| CI/Release | GitHub Actions / GitHub Releases |

---

## 🔒 Privacy

**DueSense is 100% offline.** All data is stored on your device using AsyncStorage. No analytics, no tracking, no third-party servers receive your financial data. The only network requests are:
- Checking for app updates (GitHub `update.json` + EAS Updates)

---

## 🚀 Getting Started (Development)

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`

### Setup
```bash
git clone https://github.com/MorningAppLabs/DueSense.git
cd DueSense
npm install
npx expo start
```

Scan the QR code with **Expo Go** (SDK 54) or your development build.

### Building APK (Preview)
```bash
eas build --profile preview --platform android
```

### Building Production APK
```bash
eas build --profile production --platform android
```

### Publishing OTA Update (EAS Updates)
```bash
eas update --branch production --message "v1.x.x: description"
```

---

## 📁 Project Structure

```
DueSense/
├── App.tsx                    # Root: fonts, biometric gate, OTA updates
├── index.ts                   # Entry point
├── app.json                   # Expo config (EAS project ID, runtime version)
├── eas.json                   # EAS build profiles
├── update.json                # GitHub APK update manifest
├── assets/
│   └── fonts/                 # Inter font TTFs (Regular, SemiBold, Bold)
└── src/
    ├── components/
    │   ├── ActionButton.tsx
    │   ├── Dropdown.tsx        # Custom modal-based picker (no clipping)
    │   ├── ProgressBar.tsx
    │   └── TransactionCard.tsx
    ├── constants/
    │   ├── acknowledgments.ts
    │   ├── categoryIcons.ts     # DEFAULT_CATEGORIES, ICON_PICKER_OPTIONS, getCategoryIconFull
    │   ├── changelogs.ts
    │   ├── currencies.ts
    │   ├── privacyPolicy.ts
    │   └── termsOfUse.ts
    ├── navigation/
    │   └── AppNavigator.tsx    # Custom tab bar + stack navigator
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── AddSpendingScreen.tsx
    │   ├── ShowReportScreen.tsx
    │   ├── ReportExportScreen.tsx  # PDF export (multi-card, date range, person filter)
    │   ├── MoneyOwedScreen.tsx
    │   ├── YourCardsScreen.tsx
    │   ├── BestFitCardScreen.tsx
    │   ├── RepayToCardScreen.tsx
    │   ├── SubscriptionsScreen.tsx
    │   └── SettingsScreen.tsx
    ├── store/
    │   └── store.ts            # Zustand store with AsyncStorage persistence
    ├── theme/
    │   └── theme.ts            # Colors, typography, spacing, shadows
    ├── types/
    │   └── types.ts            # TypeScript interfaces
    └── utils/
        ├── billingUtils.ts
        ├── notifications.ts
        ├── storage.ts
        ├── updateChecker.ts    # GitHub APK update nag
```

---

## 📦 Releases

Download the latest APK from [GitHub Releases](https://github.com/MorningAppLabs/DueSense/releases).

The app also supports **silent OTA updates** via EAS Updates — when a compatible update is published, the app downloads and applies it automatically in the background on next launch.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [MorningAppLabs](https://github.com/MorningAppLabs)
