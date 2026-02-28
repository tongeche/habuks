# Organization Template Upload Folder

Drop template files in this folder, then run:

```bash
npm run templates:upload
```

## Naming Convention

Use `template_key` as filename so metadata updates automatically:

- `meeting-minutes-template.docx`
- `activity-work-plan-template.docx`
- `budget-expense-tracker-template.xlsx`
- `monthly-financial-report-template.docx`
- `project-presentation-template.pptx`
- `partner-donor-register-template.xlsx`
- `member-attendance-register-template.xlsx`
- `procurement-request-template.docx`

Keep only one file per `template_key` in this root upload folder. If you are preparing an alternate format
or a later batch, place it in a subfolder until it has its own template key or rollout step.

## Commands

Global templates (default path prefix: `global/organization/templates/...`):

```bash
npm run templates:upload
```

Tenant-specific templates (prefix: `tenants/<tenant_id>/organization/templates/...`):

```bash
npm run templates:upload -- --tenant <tenant_uuid>
```

Dry run:

```bash
npm run templates:upload -- --dry-run
```
