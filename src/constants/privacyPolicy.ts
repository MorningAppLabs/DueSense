export const privacyPolicy = `
DueSense Privacy Policy
Last Updated: 06 March 2026

DueSense is developed and maintained by MorningAppLabs. We are committed to protecting your privacy. This Privacy Policy explains how we handle information within the DueSense mobile application ("App"). Please read this policy carefully. If you do not agree with the terms, please do not use the App.

1. Information We Collect

DueSense is a fully offline, privacy-first application. We do not require account creation and do not collect or transmit any personally identifiable information to external servers.

  i. Financial Data: All financial information you enter (e.g., card details, transactions, repayments, spending records) is stored exclusively on your device using local storage. This data never leaves your device unless you explicitly export a backup file.

  ii. Device Information: We do not collect device identifiers, usage analytics, or behavioral data.

  iii. No Ads: DueSense does not display advertisements and does not integrate any third-party ad networks.

2. How We Use Your Information

All data you enter is used solely to power the features within the App:
  - Tracking credit card balances, transactions, and repayments.
  - Calculating cashback estimates based on your card-specific rules.
  - Sending local push notifications for due dates and reminders.
  - Generating reports for your personal review.

3. Data Storage and Security

  i. Local-Only Storage: All your data is stored locally on your device using AsyncStorage. No data is transmitted to any server by DueSense.
  ii. Backups: If you use the backup feature, a JSON file is saved to your device. That exported file is governed by the platform or service you use to share or store it.
  iii. Security: We implement standard security practices within the App, but the security of your device is your responsibility.

4. Third-Party Services

DueSense does not integrate third-party analytics, advertising, or data-processing services. The App uses standard Expo SDK modules that operate locally on your device:
  - expo-notifications: For scheduling local on-device reminders only.
  - expo-sharing / expo-file-system: For exporting backup files at your explicit request.

5. Children's Privacy

The App is not directed at users under 13 years of age. We do not knowingly collect information from children under 13.

6. Your Rights

  i. Access and Deletion: All data is stored on your device. You can delete it at any time via the App settings or by uninstalling the App.
  ii. Data Portability: Use the Backup feature in Settings to export all your data as a JSON file.

7. Changes to This Privacy Policy

We may update this Privacy Policy to reflect changes in the App or legal requirements. The date at the top of this policy reflects when it was last updated.

8. Contact Us

If you have any questions or concerns about this Privacy Policy, please contact us at:
Email: morningapplabs@gmail.com

By using DueSense, you agree to this Privacy Policy.
`.trim();
