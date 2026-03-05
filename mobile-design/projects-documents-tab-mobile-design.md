# HABUKS – Project Documents Tab (Mobile Redesign)

## Objective

Redesign the Project Documents tab to behave like a modern mobile file manager.

Goals:

- eliminate table layout
- remove checkboxes
- simplify upload and document generation
- introduce gesture-based interactions
- make document access fast

The interface should feel similar to Google Drive or WhatsApp file lists.

---

# 1. Page Route

/projects/:projectId/documents

Accessed from project workspace tabs.

---

# 2. Page Structure

Layout order:

Project Header  
Document Action Bar  
Documents List  
Floating Action Button

---

# 3. Project Header

Reuses existing project context header.

Contains:

Project name  
Status badge  
Progress bar  
Start date  
Members count

Below the header remains the tab navigation:

Overview  
Expenses  
Docs  
Tasks

Docs is the active tab.

---

# 4. Document Action Bar

Replace the current upload/emit toggle with a simple segmented control.

Component:

Segmented switch

Options:

Upload  
Generate

Example:

[ Upload ]   [ Generate ]

Purpose:

Upload → attach an existing document  
Generate → create a document from templates

---

# 5. Upload Mode

When Upload is active, show:

Primary button:

Upload Document

Supporting text:

Accepted formats: PDF, DOCX, images

Action:

Opens file picker.

---

# 6. Generate Mode

When Generate is active, show:

Template selector.

Templates are displayed as simple cards or list items.

Example:

Project Proposal  
Project Report  
Activity Report  
Work Plan  
Concept Note  
Completion Report

Selecting one opens the document generation preview.

---

# 7. Documents List

Documents are displayed as a clean vertical list.

Remove:

Tables  
Column headers  
Checkboxes

---

## Document Item Layout

Each row shows:

File icon  
Document name  
File type  
Date created  
Action indicator

Example:

📄 Project Completion Report  
PDF  
28 Feb 2026

---

Optional indicator:

Template generated

Example:

Generated from template

---

# 8. Document Interaction

Tap document

Open document preview.

Preview options:

Download  
Share  
Delete

---

# 9. Gesture Actions

Introduce mobile gestures.

Swipe left

Reveal actions:

Delete  
Share

Swipe right

Quick download.

Long press

Enter selection mode.

Selection mode allows:

Delete multiple  
Export multiple

---

# 10. Floating Action Button

Single FAB only.

Remove duplicate upload buttons.

FAB icon:

+

FAB action:

Open document action drawer.

---

# 11. Document Action Drawer

Bottom drawer appears.

Options:

Upload document  
Generate document

Icons recommended.

Example layout:

Upload Document  
Generate from Template

---

# 12. Empty State

If no documents exist:

Illustration: document icon

Text:

No documents yet.

Supporting text:

Upload files or generate documents from templates.

Primary button:

Upload Document

Secondary:

Generate Document

---

# 13. Remove From Current UI

Remove:

Table layout  
Checkbox selection  
Upload + FAB duplication  
Column headers  
Action columns

These patterns are desktop-first and do not translate well to mobile.

---

# 14. Mobile Design Constraints

Row height minimum:

64px

Touch target:

44px minimum

Spacing between rows:

12px

Document icons:

32px

FAB spacing:

16px above bottom navigation.

---

# 15. UX Principles

The Documents page should feel like a file library.

Focus on:

Quick access  
Simple uploads  
Fast generation of reports

Avoid:

Spreadsheet UI  
Complex file tables

Users should always understand:

Where documents are  
How to upload  
How to generate reports

within 3 seconds of opening the page.

---

# End Spec