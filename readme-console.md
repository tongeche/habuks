# Habuks Internal Admin Console

## Purpose
The internal console gives allowlisted admins a controlled terminal for tenant operations.

- Shell API endpoint: `supabase/functions/admin-shell`
- UI entry: header `Shell` button in Internal Admin
- Execution model: `input` -> `run` -> poll `history` -> optional `cancel`

## Command Grammar
```bash
<resource> <verb> [options]
```

Examples:
```bash
ten ls -n 10 -s youth
ten show 04f232da-e5bb-4a63-8c12-98ae21df6f11
mem ls -t habuks-demo
prj show 42
log tail -n 100
sys status
```

## Global Commands
```bash
help
ls
pwd
whoami
clear
cls
cd ten <tenant_uuid|slug|name>
cd ..
```

## Resources
- `ten` (alias: `t`) tenant operations
- `mem` (alias: `m`) member operations
- `prj` (alias: `p`) project operations
- `fin` (alias: `f`) finance/transactions
- `doc` documents
- `log` logs
- `sys` system

## Flags
- `-n` / `--limit` result limit
- `-s` / `--search` search term
- `-t` / `--tenant` tenant filter
- `-h` / `--help` command help

## Help
```bash
help
ten --help
mem --help
prj --help
log --help
```

## Tenant Context Mode
Set active tenant:
```bash
cd ten habuks-demo
```

Leave tenant context:
```bash
cd ..
```

When context is set, tenant-scoped commands can omit `-t`.

## Supported Commands

### Tenant (`ten`)
```bash
ten ls [-n 20] [-s keyword]
ten show [tenant_uuid|slug|name]
ten stat [tenant_uuid|slug|name]
ten pause [tenant_uuid|slug|name] [--days=30]
ten resume [tenant_uuid|slug|name]
```

### Members (`mem`)
```bash
mem ls [-t tenant] [-n 50]
mem show <member_email|name|membership_id> [-t tenant]
mem pause <member_email|name|membership_id> [-t tenant]
mem resume <member_email|name|membership_id> [-t tenant]
```

### Projects (`prj`)
```bash
prj ls [-t tenant] [-n 50]
prj show <project_id|name> [-t tenant]
prj stat [-t tenant]
prj pause <project_id|name> [-t tenant]
```

### Finance (`fin`)
```bash
fin ls [-t tenant] [-n 50]
fin stat [-t tenant]
fin show <transaction_id> [-t tenant]
```

### Documents (`doc`)
```bash
doc ls [-t tenant] [-n 50]
doc show <document_id> [-t tenant]
```

### Logs (`log`)
```bash
log tail [-t tenant] [-n 100]
log sys [-n 100]
```

### System (`sys`)
```bash
sys status
sys stat
```

## Compatibility Aliases
Older phrases are normalized:
```bash
tenants list       # -> ten ls
tenant overview    # -> ten show
tenants overivew   # typo-compatible -> ten show
logs tail          # -> log tail
```

## Prompt History UX
In the shell prompt input:
- `ArrowUp`: previous command
- `ArrowDown`: next command / restore draft input
- `Enter`: run current command

## Safety Notes
Disabled commands are intentionally blocked in MVP:
```bash
ten rm
doc rm
```

`prj pause` may return an availability message if project update permissions are not enabled in the current environment.

## Typical Flow
```bash
help
ten ls -n 10
cd ten habuks-demo
mem ls
prj ls
log tail -n 50
ten pause --days=30
```
