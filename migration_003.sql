-- Migration 003: Add volunteers table for project volunteer registration

-- Volunteers table
CREATE TABLE volunteers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Volunteer assignments to projects
CREATE TABLE volunteer_project_assignments (
    id SERIAL PRIMARY KEY,
    volunteer_id INTEGER REFERENCES volunteers(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES iga_projects(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(100),
    status VARCHAR(50),
    notes TEXT
);

-- Enable RLS for volunteers
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

-- Policy: Volunteers can view their own profile
CREATE POLICY "Volunteers can view own profile" ON volunteers
FOR SELECT USING (auth.uid() = NULL); -- Adjust if volunteers use auth

-- Enable RLS for volunteer_project_assignments
ALTER TABLE volunteer_project_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Volunteers can view their own assignments
CREATE POLICY "Volunteers can view own assignments" ON volunteer_project_assignments
FOR SELECT USING (true); -- Adjust if volunteers use auth

-- Add more policies as needed for volunteer management.
