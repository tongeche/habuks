# HABUKS – Project Tasks Tab (Mobile Redesign)

## Objective

Redesign the Project Tasks tab to support fast task tracking in community projects.

Goals:

- simplify task creation
- remove table-style UI
- reduce filter clutter
- prioritize task status visibility
- introduce mobile gestures

The interface should feel like a lightweight task manager rather than a spreadsheet.

---

# 1. Page Route

/projects/:projectId/tasks

Accessible from project workspace tabs.

---

# 2. Page Structure

Layout order:

Project Header  
Task Status Filter  
Tasks List  
Floating Action Button

---

# 3. Project Header

Reuse the existing project summary block.

Contains:

Project name  
Status badge  
Progress bar  
Start date  
Member count

Below remains the tab navigation:

Overview  
Expenses  
Docs  
Tasks

Tasks is active.

---

# 4. Task Status Filter

Instead of dropdown filters, use horizontal status chips.

Example:

All  
Open  
In Progress  
Completed

Displayed as scrollable chips.

Example UI:

[All] [Open] [In Progress] [Completed]

Purpose:

Quick filtering with a single tap.

---

# 5. Tasks List

The main interface is a vertical list of task cards.

Remove:

Tables  
Checkbox rows  
Column headers  
Search-first UI

Search becomes secondary.

---

# 6. Task Item Layout

Each task card shows:

Completion checkbox  
Task title  
Assignee avatar  
Due date  
Priority indicator

Example:

☐ Buy seeds for farm project  
Assigned to: John  
Due: Mar 10  
Priority: Medium

---

Optional indicators:

Attachment icon  
Comment count

Example:

📎 2 attachments  
💬 3 comments

---

# 7. Task Interaction

Tap task

Opens Task Detail screen.

Task detail allows:

Edit task  
Add comments  
Upload attachments  
Change status  
Change assignee

---

# 8. Quick Task Completion

Checkbox allows quick completion.

Tap checkbox → mark task completed.

Completed tasks automatically move to the Completed filter.

---

# 9. Gestures

Introduce mobile gesture interactions.

Swipe right

Mark task completed.

Swipe left

Reveal quick actions:

Edit  
Delete

---

# 10. Floating Action Button

Single FAB.

Icon:

+

Action:

Create new task.

FAB opens bottom drawer.

---

# 11. Add Task Drawer

Bottom drawer appears.

Fields:

Task title  
Description  
Assignee  
Due date  
Priority  
Attachments

Primary action:

Create Task

Secondary:

Cancel

---

# 12. Empty State

If no tasks exist:

Display message:

No tasks yet.

Supporting text:

Break the project into smaller activities.

Primary button:

Add Task

---

# 13. Optional Search

Search field hidden by default.

Activated when user taps search icon in header.

Purpose:

Find tasks quickly in large projects.

---

# 14. Remove From Current Design

Remove:

Search box always visible  
Status dropdown  
Assignee dropdown  
Clear filters button  
Checkbox selection mode  
Task tables

These patterns are desktop-first.

---

# 15. Mobile Design Constraints

Task card minimum height:

64px

Spacing between cards:

12px

Touch targets:

Minimum 44px

Avatar size:

28px

FAB spacing:

16px above bottom navigation.

---

# 16. UX Principles

The Tasks page must prioritize:

Fast task capture  
Clear progress tracking  
Simple completion

Users should be able to:

Add a task in under 5 seconds  
Mark a task complete in one tap

The interface should reduce cognitive load for non-technical community users.

---

# End Spec