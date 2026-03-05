# HABUKS – Mobile Navigation System

## Objective

Define a consistent navigation system for the mobile application.

Goals:
- Eliminate desktop-style navigation patterns
- Provide predictable movement between modules
- Reduce cognitive load
- Support contextual project workspaces
- Maintain one primary action per screen

The navigation system consists of:

1. Global Header
2. Bottom Navigation
3. Floating Action Button (FAB)
4. Bottom Drawers for secondary actions
5. Context Scoping (Project vs Organization)

---

# 1. Global Navigation Layers

Mobile navigation is structured in 3 layers.

Layer 1 – Global navigation  
Layer 2 – Section navigation  
Layer 3 – Context actions

---

## Layer 1 – Global Navigation

Controlled by **Bottom Navigation**.

Accessible from anywhere.

Modules:

Home  
Projects  
Finance  
People  
More

These represent the primary areas of the app.

---

## Layer 2 – Section Navigation

Occurs within modules.

Examples:

Projects → Project list → Project detail  
Finance → Contributions / Expenses / Transactions  
Settings → Members / Templates / Records

Section navigation always uses:

- full screen transitions
- back arrow navigation

Never nested tabs inside mobile settings.

---

## Layer 3 – Context Actions

Actions related to the current screen.

Examples:

Add project  
Upload document  
Generate document  
Add member

These are triggered through:

Floating Action Button (FAB)

or

Bottom drawer actions.

---

# 2. Bottom Navigation

Located at the bottom of the screen.

-------------------------------------------------
Home | Projects | Finance | People | More
-------------------------------------------------

Maximum 5 items.

Icons + labels.

---

## 2.1 Home

Purpose:
Workspace overview.

Displays:

Hero project  
Upcoming activities  
Recent activity  

No FAB.

---

## 2.2 Projects

Purpose:
Project management.

Displays:

Project list.

Tap project → Project detail.

FAB action:

+ New Project

---

## 2.3 Finance

Purpose:
Financial tracking.

Includes:

Contributions  
Expenses  
Transactions  

FAB action:

+ Record

---

## 2.4 People

Purpose:
Member management.

Displays:

Members list.

FAB action:

+ Add Member

---

## 2.5 More

Purpose:
Access less frequently used modules.

Contains:

Organization settings  
Templates  
Records  
Partners  
Help  
App settings

---

# 3. Floating Action Button (FAB)

Each section has **one primary action**.

Rules:

- Only one FAB visible at a time
- Always bottom-right
- Circular button
- Primary color

---

## Section FAB Map

Home → none

Projects → + New Project

Finance → + Record Transaction

People → + Add Member

Documents → + Add Document

Templates → + Create Template

Partners → + Add Partner

---

## FAB Interaction

Tap FAB → bottom drawer.

Example:

Add Document:

Upload file  
Generate from template

Example:

Add Member:

Add manually  
Invite by email  
Import CSV

---

# 4. Bottom Drawer Pattern

Bottom drawers are used for:

- Action selection
- Quick configuration
- Secondary menus

Used instead of modals or navigation pushes.

---

## Drawer Behavior

Slides from bottom.

Max height:
60–70% screen.

Dismiss:

Swipe down  
Tap outside

---

## Drawer Examples

Account drawer (avatar tap)

Search drawer

Notification drawer

FAB action drawers

Project action drawer

---

# 5. Context Scoping

The system supports **context switching**.

Two scopes exist:

Organization scope  
Project scope

---

## Organization Scope

Used for:

Members  
Records  
Templates  
Partners  
Organization defaults

These apply globally.

---

## Project Scope

Activated when user enters a project.

Project navigation contains:

Overview  
Expenses  
Documents  
Tasks  
Notes

All data automatically filtered by project.

---

# 6. Navigation Principles

The mobile navigation system follows strict rules.

---

## Rule 1

Maximum **one primary action per screen**.

---

## Rule 2

Avoid multiple navigation systems.

No:

Sidebar + bottom navigation.

---

## Rule 3

Avoid dashboard analytics in configuration screens.

Settings should not look like dashboards.

---

## Rule 4

Actions must be discoverable.

If action frequency > weekly → FAB.

If action frequency < monthly → inside settings.

---

## Rule 5

Do not mix tabs and pills.

Use:

Full screen navigation  
OR segmented tabs

Never both.

---

# 7. Navigation Hierarchy Example

Example flow:

Home  
→ Projects  
→ Project Detail  
→ Documents  
→ Generate Document

Back navigation returns step-by-step.

No deep modal stacks.

---

# 8. Mobile Design Constraints

Touch targets ≥ 44px.

Icons 24px.

Bottom navigation height 56px.

FAB offset from bottom nav:

16px.

---

# 9. Accessibility

Ensure:

Keyboard accessible search.

Large tap targets.

Readable contrast.

Drawer dismiss gesture available.

---

# End Spec