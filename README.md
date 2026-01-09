# JONGOL Foundation

A member dashboard and contribution tracking system for JONGOL Foundation - a Kenya-based community self-help group.

## Overview

JONGOL Foundation is a self-help group of 12 members who contribute **Ksh. 500** biweekly to a rotating savings fund. Each cycle, one member receives **Ksh. 5,000** (pooled from all contributions), with **Ksh. 1,000** going to the welfare fund.

### Key Features

- 🏦 **Member Dashboard** - Track contributions, payouts, and welfare savings
- 💳 **Digital Member Card** - Personalized debit-card style member identification
- 📊 **Contribution Tracking** - View payment history and upcoming schedules
- 🔄 **Payout Countdown** - See when your payout is coming
- 🤝 **Welfare Management** - Emergency funds and member support tracking
- 📱 **Phone Authentication** - Login with phone number (no email required)

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Supabase (PostgreSQL + Auth)
- **Styling:** Custom CSS with CSS variables
- **Icons:** Custom icon components

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/jongol-foundation.git
cd jongol-foundation
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

5. Run database migrations in Supabase SQL Editor:
   - `schema.sql` - Base schema
   - `migration_002.sql` through `migration_007_admin_invites.sql`
   - `seed.sql` - Sample data

6. Start development server:
```bash
npm run dev
```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── dashboard/       # Dashboard pages
│   │   │   ├── DashboardOverview.jsx
│   │   │   ├── ContributionsPage.jsx
│   │   │   ├── PayoutsPage.jsx
│   │   │   ├── WelfarePage.jsx
│   │   │   └── ...
│   │   ├── LoginPage.jsx
│   │   └── ...
│   ├── lib/
│   │   ├── supabase.js      # Supabase client
│   │   └── dataService.js   # Data fetching utilities
│   ├── styles.css           # Global styles
│   └── App.jsx
├── public/
│   └── assets/
├── *.sql                    # Database migrations
└── package.json
```

## Contribution Schedule

| Cycle | Member     | Payout Date    |
|-------|------------|----------------|
| 1     | Orpah      | Dec 15, 2025   |
| 2     | Shadrack   | Dec 30, 2025   |
| 3     | Ketty      | Jan 15, 2026   |
| 4     | Osero      | Jan 30, 2026   |
| 5     | Cynthia    | Feb 15, 2026   |
| 6     | Geoffrey   | Feb 28, 2026   |
| 7     | Oketch     | Mar 15, 2026   |
| 8     | Timothy    | Mar 30, 2026   |
| 9     | Lavenda    | Apr 15, 2026   |
| 10    | Malaika    | Apr 30, 2026   |
| 11    | Lydia      | May 15, 2026   |
| 12    | Quinter    | May 30, 2026   |

## License

This project is private and intended for JONGOL Foundation members only.

---

Made with ❤️ for JONGOL Foundation
