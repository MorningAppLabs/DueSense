# DueSense Notification System Analysis

**Date:** November 11, 2025

---

## Current Notification System

### Three Notification Types

1. **Due Date Reminder** — Fires on billing cycle end date (when bill is generated)
   - Scheduled in: `ShowReportScreen.tsx` (useEffect)
   - Triggered: When user views a card's report

2. **Bill and EMI Reminder** — Also fires on billing cycle end date
   - Scheduled in: `ShowReportScreen.tsx` (useEffect)
   - Triggered: When user views a card's report
   - **⚠️ ISSUE:** Both Due Date and Bill reminders fire at the same time

3. **General Owed-Money Reminder** — Fires 10 days after cycle end
   - Scheduled in: `ShowReportScreen.tsx` (useEffect)
   - Triggered: When user views a card's report

4. **Individual Owed-Money Reminder** — For "Someone Else" transactions
   - Scheduled in: `store.ts` addTransaction
   - Triggered: When user adds a transaction for someone else

---

## Issues Identified

### 🔴 CRITICAL ISSUE: Duplicate Reminders

**Problem:** The two bill-related reminders (Due Date + Bill/EMI) are BOTH scheduled to fire at the exact same time (billing cycle end date). This violates UX best practice and could confuse users.

**Reason:** Both notifications use the same trigger:
```typescript
// ShowReportScreen.tsx
const dueDate = end.toDate();  // Same end date
const billDate = end.toDate();  // Same end date - DUPLICATE!
```

**Expected Behavior:** Only ONE notification per billing cycle for bill-related matters.

**Recommendation:** 
- **Option A (Preferred):** Remove one of them (Bill/EMI reminder is redundant if Due Date exists)
- **Option B:** Differentiate the timing (e.g., Due Date on end date, Bill/EMI 1 day after)

---

### 🟡 MEDIUM ISSUE: No Descriptions for Users

**Problem:** Settings page shows toggle labels but NO explanations of what each notification does

**Current:**
```
Due Date Reminder        [Toggle]
Owed-Money Reminder      [Toggle]
Bill and EMI Reminder    [Toggle]
```

**Better:**
```
Due Date Reminder        [Toggle]
📝 Reminder when your bill is ready for payment (on billing cycle end date)

Owed-Money Reminder      [Toggle]
📝 Reminder to collect money owed from friends (after bill generation + 10 days)

Bill and EMI Reminder    [Toggle]
📝 Notification for bills and EMI payments due (on billing cycle end date)
```

---

### 🟡 MEDIUM ISSUE: No User Control Over Owed-Money Timing

**Problem:** General owed-money reminder is hardcoded to fire 10 days after cycle end

**Current Code:**
```typescript
const owedDate = moment(end).add(10, "days").toDate();  // Hardcoded to 10 days
```

**Analysis of Necessity:**
- ✅ **Necessary** if:
  - User wants flexibility (e.g., "remind me 5 days after bill, not 10")
  - Different billing scenarios need different timings
  - User behavior data suggests people prefer different delays
  
- ❌ **Overkill if:**
  - 10 days is optimal for most use cases
  - UI complexity not worth the control
  - Most users won't change it

**Current Decision:** 10 days is reasonable (gives user time to pay bill before chasing friends)

---

### 🟢 FEATURE GAP: Notification Preferences Not Fully Used

**Problem:** User can set notification time in Settings, but system doesn't check `enabled` flag before scheduling

**Current Logic:**
```typescript
// Notifications are scheduled EVERY TIME ShowReportScreen opens, regardless of enabled state
if (!notificationIds[dueDateKey]) {
  // No check for dueDateReminderEnabled!
  const identifier = await scheduleDueDateReminder(...);
}
```

**Impact:** Reminders are always scheduled regardless of toggle state. The toggle only controls AsyncStorage preference, not actual scheduling.

---

## How It Should Work (Flow Chart)

### When User Adds a Transaction for Someone Else

```
User fills form → ForWhom = "Someone Else" → Transaction added
                                           ↓
                        store.addTransaction() triggered
                                           ↓
                        Check: forWhom === "Someone Else" 
                             && !repaid
                                           ↓
                        scheduleOwedMoneyReminder(
                          personName, amount, 
                          settings.notificationTimes.owedMoney
                        )
```
✅ **Working as intended**

---

### When User Views Report (ShowReportScreen)

```
User opens ShowReportScreen
Select card + billing cycle
                           ↓
useEffect triggers with [cardId, billingCycle]
                           ↓
Compute billing cycle dates
                           ↓
        ┌─────────────────┬─────────────────┬─────────────────┐
        ↓                 ↓                 ↓                 ↓
   Due Date         Bill/EMI           Owed Money       (DUPLICATE!)
   Reminder         Reminder           Reminder
   End Date         End Date       End Date + 10 days
     ↓                 ↓                 ↓
Check if          Check if          Check if
already           already           already
scheduled         scheduled         scheduled
   ↓                 ↓                 ↓
If NO, create  If NO, create   If NO, create
notification   notification    notification
```

**Issue:** Two notifications fire at same time

---

## Summary

| Issue | Severity | Current Status | Fix Needed |
|---|---|---|---|
| Duplicate Due Date + Bill reminders | 🔴 Critical | ✅ Identified | Consolidate/separate timing |
| No descriptions for reminders | 🟡 Medium | ❌ Missing | Add explanatory text |
| Hardcoded 10-day owed reminder delay | 🟡 Medium | ✓ OK | Optional: add user control |
| Enabled flag not checked during scheduling | 🟡 Medium | ⚠️ Partial | Check toggle state before scheduling |
| Notification duplication risk on app restart | 🟡 Medium | ⚠️ Existing | Validate/cancel old before scheduling |

---

## Recommended Fixes (Priority Order)

1. ✅ **Add description text to each notification toggle** (Easy, high UX impact)
2. ✅ **Consolidate duplicate reminders** (Medium difficulty)
3. ✅ **Check `enabled` flag before scheduling** (Medium difficulty)
4. ⭕ **Add user control for owed-money delay** (Optional, can add later)

