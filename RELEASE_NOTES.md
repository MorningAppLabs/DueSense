# DueSense — Release Notes

---

## v1.0.0 — Initial Release
**Release Date:** March 2026  
**APK:** [DueSense-v1.0.0.apk](https://github.com/MorningAppLabs/DueSense/releases/download/v1.0.0/DueSense-v1.0.0.apk)

---

### 🎉 Welcome to DueSense

DueSense is a privacy-first, fully offline credit card management app. All your financial data stays on your device — no accounts, no cloud sync, no tracking.

---

### ✨ What's Included in v1.0.0

#### 💳 Card Management
- Add and manage multiple credit cards
- Custom billing cycle start/end days per card
- Credit limit and due-date tracking
- Color-coded cards with network badges (Visa, Mastercard, RuPay, Amex, Diners)
- Last 4 digits display for easy identification
- Annual fee tracking with 30-day advance alerts
- Annual fee waiver threshold — shows how much more you need to spend to get the fee waived
- Per-card cashback rules engine (merchant, category, online/offline, full/EMI)

#### 💸 Spending Tracker
- 3-step guided transaction entry: Card + Amount → Details → Attribution
- 10 built-in categories with icons (Food, Travel, Fuel, Shopping, Entertainment, Bills, Health, Education, Grocery, Others)
- Custom category creation: choose any name and pick from 35 icon options
- Currency symbol prefix on the amount input field
- Full Payment and EMI modes with configurable months and interest
- Online / Offline spend classification
- Real-time cashback estimate as you fill in the transaction
- "Paid for someone else" mode: name the person, optionally mark as already repaid

#### 📊 Reports
- Per-card, per-billing-cycle transaction reports
- Searchable by merchant, description, or category
- Summary bar: total spent, unbilled, cashback earned, transaction count
- Edit transactions inline (amount, merchant, category, description)
- Delete transactions with confirmation
- **Export PDF Report** — select cards, date range, and person filter; generates a shareable PDF with cashback and notes columns

#### 👥 Money Owed
- Automatic grouping of "paid for others" transactions by person
- Beautiful formatted payment reminder message (WhatsApp / Telegram / Email / File share):
  - Emoji-rich layout with transaction details
  - Total amount clearly highlighted
  - Separator lines for readability
  - "Sent via DueSense" footer
- Mark individual transactions as repaid
- Filter by person name

#### 🔁 Subscriptions
- Track recurring subscriptions: Monthly, Quarterly, Yearly, Weekly
- Payment method: Card, UPI, PayPal, Other
- 12 built-in categories with icons (Streaming, Gaming, Music, Software, Cloud, Food, Shopping, Entertainment, Health, Education, Bills, Others)
- Custom category with icon picker when "Others" is selected
- Active count, monthly cost summary, "due this week" alerts
- Always visible on Home screen — tap to navigate even with zero subscriptions
- Pause/reactivate subscriptions individually

#### 🔍 Best Fit Card
- Enter a merchant + category + payment mode
- App ranks all your cards by cashback percentage for that scenario
- Reasons shown for each card's ranking

#### 🔢 Repayment Tracker
- Log repayments against any card's billing cycle
- Tracks outstanding unbilled vs repaid balance

#### 🔔 Smart Notifications
- Due-date bill reminders (configurable daily time)
- Money-owed reminders
- EMI payment reminders
- **Subscription billing-date reminders** — notifies you on each subscription's exact renewal date
- Per-type enable/disable toggle with custom notification times
- Global notification handler ensures alerts appear reliably

#### ⚙️ Settings
- **Currency** — 35+ currencies with symbol selector (searchable dropdown)
- **Notifications** — configure time and toggle per notification type
- **Biometric Lock** — protect app with fingerprint / face unlock
- **Backup & Restore** — export/import all data as a JSON file
- **OTA Updates** — silent automatic updates via EAS Updates (background, on next launch)
- **Check for Updates** — manually check GitHub Releases for a new APK
- **App Version** — displays the installed app version
- Privacy Policy, Terms of Use, and Changelog accessible in-app

---

### 🛠 Technical Highlights

- Built on **React Native + Expo SDK 54** with New Architecture (Fabric) enabled
- Custom **modal-based Dropdown** component — eliminates the overflow-clipping issue of native pickers
- Fully custom **bottom tab bar** — Pressable-based, pill icon design, no clipping
- **Inter font** loaded from local assets via `expo-font`
- **Zustand** state management with AsyncStorage persistence
- **EAS Updates** configured — publish silent OTA patches without a new APK release
- **100% local storage** — no network requests except update checks
- `KeyboardAvoidingView` on all screens with text inputs

---

### 📦 Installation

1. Download `DueSense-v1.0.0.apk` from this release
2. Enable "Install from Unknown Sources" in Android settings
3. Open the APK and install
4. No account needed — launch and start adding your cards

---

### 🔒 Privacy

DueSense does not collect, transmit, or store any of your data on external servers. All card details, transactions, and settings remain entirely on your device.

---

### 🐛 Known Limitations in v1.0.0

- iOS build not yet available (Android only)
- No recurring transaction auto-logging (manual entry required)
- No multi-currency per card (uses global currency setting)
- No dark mode (planned for a future release)

---

*Made with ❤️ by MorningAppLabs*
