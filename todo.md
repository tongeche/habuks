# HABUKS – Project Management Mobile IA

## Objective

Define the mobile information architecture for managing projects.

Goals:
- Provide a clear operational workspace for each project
- Keep project data scoped and organized
- Reduce clutter from dashboard-style layouts
- Support quick task execution and documentation
- Maintain consistency with the global mobile navigation system

---

# 1. Entry Point

Route:

/projects

Displays the **Project List**.

---

# 2. Project List Screen

## Layout

Header:
Projects

Search bar (optional)

Project list below.

---

## Project Card

Each project appears as a card containing:

Project Title  
Category  
Status badge  
Progress bar  
Member count  
Start date  

Tap → open Project Detail.

Long press → enable selection mode.

---

## Primary Action

FAB:

+ New Project

Opens bottom drawer.

Options:

Create project manually  
Import project template

---

# 3. Project Detail Workspace

Route:

/projects/:projectId

The project page acts as a mini workspace.

---

## Header

Back arrow  
Project name  
⋯ (project actions)

Project actions drawer:

Edit project  
Duplicate project  
Archive project  
Delete project

---

# 4. Project Navigation

Project sections are accessed through tabs.

Overview  
Expenses  
Documents  
Tasks  
Notes

Each tab represents a functional workspace.

---

# 5. Overview Tab

Purpose:
Provide quick project status.

Displays:

Project summary  
Progress bar  
Member count  
Start date  
Completion rate  

Task summary:

Total tasks  
Completed tasks  
Overdue tasks  

Financial snapshot:

Total budget  
Total spent  
Remaining balance

---

# 6. Tasks Tab

Purpose:
Manage project execution.

Displays:

Task list grouped by status.

Statuses:

To Do  
In Progress  
Completed  

Task card contains:

Task title  
Assigned member  
Priority  
Due date  

Tap task → open task detail.

---

## Primary Action

FAB:

+ Add Task

Opens task creation drawer.

Fields:

Task title  
Assigned member  
Priority  
Due date  
Description

---

# 7. Expenses Tab

Purpose:
Track project financial activity.

Displays:

Expense list.

Expense item:

Title  
Amount  
Category  
Date  
Proof indicator

---

## Primary Action

FAB:

+ Record Expense

Drawer fields:

Expense title  
Amount  
Category  
Proof attachment  
Notes

---

# 8. Documents Tab

Purpose:
Manage project documentation.

Displays:

Document list.

Document item:

File icon  
Title  
Type  
Upload date  

Tap → open preview.

---

## Primary Action

FAB:

+ Add Document

Drawer options:

Upload file  
Generate from template

---

# 9. Notes Tab

Purpose:
Capture project observations and discussions.

Displays:

Chronological note feed.

Each note contains:

Author  
Date  
Content  

Tap note → expand full view.

---

## Primary Action

FAB:

+ Add Note

Drawer fields:

Title  
Content

---

# 10. Project Actions Drawer

Triggered by the ⋯ icon.

Options:

Edit project  
Duplicate project  
Archive project  
Delete project

Destructive actions require confirmation.

---

# 11. Data Scope

When user is inside a project:

All modules filter automatically by project_id.

Affected modules:

Tasks  
Expenses  
Documents  
Notes  
Activities

---

# 12. Navigation Flow Example

Projects  
→ Project Detail  
→ Tasks  
→ Task Detail

Back navigation returns step-by-step.

No deep modal stacks.

---

# 13. Design Rules

Each project screen must follow these rules:

One FAB per tab.

No analytics dashboards inside operational screens.

No KPI blocks above lists.

Actions accessible via FAB or drawer.

---

# 14. Accessibility

Touch targets ≥ 44px.

Scrollable lists must remain responsive.

FAB reachable with thumb zone.

---

# End Spec