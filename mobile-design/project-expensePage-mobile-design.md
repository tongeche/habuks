# HABUKS – Project Expenses Tab (Mobile Redesign)

## Objective

Redesign the Project Expenses tab to prioritize:

- quick expense recording
- simple financial visibility
- clean mobile list interaction
- minimal analytics clutter

The page should feel similar to a **bank transaction list**, not a spreadsheet.

---

# 1. Page Route

/projects/:projectId/expenses

Accessed from the project workspace tabs.

---

# 2. Page Structure

The page contains four sections:

1. Project Header
2. Financial Summary
3. Expense List
4. Floating Action Button

Layout:

Project Header  
Financial Summary  
Expenses List  
FAB

---

# 3. Project Header

Displays minimal project context.

Content:

Project name  
Project status  
Progress indicator

Example:

minuto  
Active  
62% progress

Additional context:

Start date  
Member count

Example:

Started: N/A  
1 member

---

# 4. Financial Summary

Shows three key indicators.

Layout:

Three compact summary cards.

Fields:

Budget allocated  
Amount spent  
Remaining balance

Example:

Budget Allocated  
EUR 10,000

Amount Spent  
EUR 900

Remaining  
EUR 9,100

---

## Rules

These cards must remain **compact and static**.

Do not include charts or graphs.

Purpose:

Provide quick financial context.

---

# 5. Expense List

The main interface is a chronological list of expenses.

Layout:

Scrollable list.

Newest expenses appear first.

---

## Expense Item Structure

Each expense row contains:

Category icon  
Expense title  
Category  
Amount  
Date

Example:

Transport to Field  
Logistics  
EUR 50  
Mar 5

---

## Additional Indicators

Optional icons may show:

Receipt attached  
Approval status

Example:

📎 Receipt attached

---

# 6. Expense Interaction

Tap expense → open expense detail view.

Expense detail screen allows:

View receipt  
Edit expense  
Delete expense

---

# 7. Empty State

If no expenses exist:

Display message:

No expenses recorded yet.

Supporting text:

Start tracking project spending.

Primary button:

Add Expense

---

# 8. Floating Action Button

FAB located bottom-right.

Icon:

+

Action:

Add Expense

---

## Add Expense Drawer

Tap FAB → bottom drawer.

Fields:

Expense title  
Amount  
Category  
Date  
Attach receipt  
Notes

Primary action:

Save Expense

---

# 9. Selection Mode

Selection is activated by **long press** on an expense item.

Selection mode allows:

Delete  
Export  
Bulk approval

Top bar appears during selection.

---

# 10. Remove From Current Design

The redesign removes:

Expense table layout  
Column headers  
Checkboxes by default  
Large analytics blocks  
Multiple action buttons

These patterns do not work well on mobile.

---

# 11. Mobile Design Constraints

Row height:

Minimum 60px

Spacing:

12px between rows

Touch targets:

Minimum 44px

FAB spacing:

16px above bottom navigation.

---

# 12. UX Principles

The Expenses page should feel:

Fast  
Scannable  
Action-oriented

Focus on:

Recording expenses quickly  
Viewing spending clearly

Avoid:

Spreadsheet-like layouts  
Overloaded financial dashboards

---

# End Spec