export const changelogs = [
  {
    // Add this new entry
    version: "1.1.0", // Consider updating this to your next version number
    date: "09 June 2025", // Replace with the actual date of this release
    description: `

**Enhancements and Bug Fixes:**

- **Home Screen:**
  - Implemented dynamic color changes for progress bars to visually indicate spending level.
  - Improved layout of action buttons ('Add Spending', 'Repay to Card', 'Best Fit Card') for better responsiveness on narrow screens.
  - Fixed issue where 'Transaction & Cashback' data was not dynamically reflecting current billing cycle transactions.

- **Navigation:**
  - Adjusted bottom tab layout to prevent truncation of the 'Money Owed' label on smaller screens.
  - Added logic to direct first-time users without cards to the 'Your Cards' section when attempting to add spending.

- **Card Management:**
  - Corrected validation logic for billing cycle start and end days to properly handle cycles spanning across month boundaries.

- **Reports Screen:**
  - Added 'Total Cashback' to the report summary for the selected billing cycle.
  - Included cashback amount display for individual transactions in the transaction list.
  - Enhanced the transaction editing modal to include fields for Merchant, Category, and Description, with dynamic cashback recalculation based on changes.
`.trim(), // Using trim() is good practice to remove leading/trailing whitespace
  },
  { version: "1.0.0", date: "17 May 2025", description: "Alpha release" },
  // Add more entries as needed
];
