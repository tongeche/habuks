-- JONGOL FOUNDATION Database Schema for Supabase Migration

-- Members (phone_number is primary identifier, email is optional)
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    join_date DATE NOT NULL,
    status VARCHAR(50),
    role VARCHAR(50)
);

-- Officials
CREATE TABLE officials (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    role VARCHAR(100) NOT NULL,
    term_start DATE,
    term_end DATE
);

-- Committees
CREATE TABLE committees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE committee_members (
    id SERIAL PRIMARY KEY,
    committee_id INTEGER REFERENCES committees(id),
    member_id INTEGER REFERENCES members(id),
    role VARCHAR(100),
    term_start DATE,
    term_end DATE
);

-- Meetings & Minutes
CREATE TABLE meetings (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    type VARCHAR(100),
    agenda TEXT,
    minutes TEXT,
    attendees INTEGER[]
);

-- Group Assets
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    value NUMERIC(12,2),
    status VARCHAR(50),
    acquired_date DATE
);

-- Documents (Constitution, Bylaws, Policies, Templates)
CREATE TABLE documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50),
    file_url TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contributions
CREATE TABLE contributions (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    amount NUMERIC(10,2) NOT NULL,
    date DATE NOT NULL,
    cycle_number INTEGER
);

-- Payouts
CREATE TABLE payouts (
    id SERIAL PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    amount NUMERIC(10,2) NOT NULL,
    date DATE NOT NULL,
    cycle_number INTEGER
);

-- Blogs/News
CREATE TABLE blogs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES members(id),
    date_posted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(50)
);

-- IGA Projects
CREATE TABLE iga_projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    project_leader INTEGER REFERENCES members(id),
    objectives TEXT,
    expected_outcomes TEXT,
    beneficiaries TEXT,
    funding_sources TEXT,
    status VARCHAR(50),
    location VARCHAR(100),
    risks_and_mitigations TEXT,
    monitoring_indicators TEXT,
    last_report_date DATE
);

-- IGA Committee Members
CREATE TABLE iga_committee_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    member_id INTEGER REFERENCES members(id),
    role VARCHAR(100),
    term_start DATE,
    term_end DATE
);

-- IGA Activities
CREATE TABLE iga_activities (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    activity_name VARCHAR(100),
    description TEXT,
    responsible_member_id INTEGER REFERENCES members(id),
    deadline DATE,
    status VARCHAR(50)
);

-- IGA Budgets
CREATE TABLE iga_budgets (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    item VARCHAR(100),
    planned_amount NUMERIC(12,2),
    actual_amount NUMERIC(12,2),
    date DATE,
    notes TEXT
);

-- IGA Reports
CREATE TABLE iga_reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    report_type VARCHAR(50),
    period_start DATE,
    period_end DATE,
    content TEXT,
    submitted_by INTEGER REFERENCES members(id),
    date_submitted DATE
);

-- IGA Beneficiaries
CREATE TABLE iga_beneficiaries (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    beneficiary_name VARCHAR(100),
    type VARCHAR(50),
    contact_info TEXT,
    notes TEXT
);

-- IGA Inventory
CREATE TABLE iga_inventory (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    item_name VARCHAR(100),
    quantity INTEGER,
    value NUMERIC(12,2),
    status VARCHAR(50),
    assigned_to INTEGER REFERENCES members(id),
    notes TEXT
);

-- IGA Sales
CREATE TABLE iga_sales (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    product VARCHAR(100),
    quantity INTEGER,
    unit_price NUMERIC(10,2),
    total_amount NUMERIC(12,2),
    buyer VARCHAR(100),
    date DATE,
    notes TEXT
);

-- IGA Training Sessions (no trainer field)
CREATE TABLE iga_training_sessions (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES iga_projects(id),
    topic VARCHAR(100),
    date DATE,
    attendees TEXT,
    outcomes TEXT,
    notes TEXT
);

-- Welfare Accounts
CREATE TABLE welfare_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

-- Welfare Cycles
CREATE TABLE welfare_cycles (
    id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE,
    cycle_number INTEGER NOT NULL,
    total_contributed NUMERIC(12,2),
    total_disbursed NUMERIC(12,2)
);

-- Welfare Transactions
CREATE TABLE welfare_transactions (
    id SERIAL PRIMARY KEY,
    welfare_account_id INTEGER REFERENCES welfare_accounts(id),
    cycle_id INTEGER REFERENCES welfare_cycles(id),
    member_id INTEGER REFERENCES members(id),
    amount NUMERIC(12,2) NOT NULL,
    transaction_type VARCHAR(50),
    date DATE NOT NULL,
    description TEXT
);

-- Welfare Balances
CREATE TABLE welfare_balances (
    id SERIAL PRIMARY KEY,
    welfare_account_id INTEGER REFERENCES welfare_accounts(id),
    cycle_id INTEGER REFERENCES welfare_cycles(id),
    balance NUMERIC(12,2) NOT NULL
);
