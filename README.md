# Habuks – Collective Operations & IGA Management Platform

Habuks is a lightweight operations dashboard designed to help small groups, self-help associations, and micro-organizations manage projects, members, and income-generating activities (IGAs).
the platform has evolved into a reusable system for structured coordination, financial tracking, and collaborative project oversight.

---

## Overview

Habuks enables small collectives to:

* Track projects and operational activities
* Manage members and access roles
* Monitor income-generating activities (IGAs)
* Maintain structured financial and contribution records
* Centralize group-level coordination in one secure dashboard

The system is designed for low-resource environments where clarity, accountability, and simplicity matter.

---

## Tech Stack

Frontend:

* React + Vite

Backend & Database:

* Supabase (PostgreSQL + Authentication)

Architecture:

* Role-based access control
* Relational database design
* Secure environment-based configuration

---

## Core Features

* Member authentication and role management
* Project and activity tracking
* Contribution and bookkeeping records
* Structured relational data model
* Admin invite and access control workflows

---

## Database & Setup

Environment configuration:

```bash
npm install
cp .env.example .env   # Add Supabase credentials
npm run dev
```

Database migrations (run sequentially in Supabase SQL Editor):

1. supabase/schema.sql
2. migration files (admin + role control updates)

---

## Design Philosophy

Habuks is built around:

* Simplicity over feature bloat
* Structured relational data
* Transparency and accountability
* Scalability from single-group to multi-tenant potential

---

## Future Direction

* Multi-tenant architecture
* IGA analytics dashboard
* Contribution reporting automation
* Mobile-first optimizations

e you planning to evolve Habuks into a true multi-tenant SaaS? If yes, we should rename the repo before recruiters see it.
