# HABUKS – Mobile Authentication & Access Flow

## Objective

Design a simple, predictable authentication flow for mobile users.

Goals:

- Remove confusion between login, signup, and invite flows
- Allow invited members to join quickly
- Keep the entry experience minimal
- Support non-technical users
- Avoid marketing pages in the authentication path

---

# 1. Entry Routes

The authentication system supports four entry points.

## Routes

/ welcome  
/ login  
/ signup  
/ invite/:token  

---

# 2. Welcome Screen

Purpose:

Provide a simple entry router for new or returning users.

---

## Layout

Logo

Title  
Manage your organization workspace

Subtitle  
Track projects, members, finances, and documents in one place.

Primary Button  
Sign In

Secondary Button  
Create Organization

Link  
Join with invite

---

# 3. Login Screen

Route:

/login

---

## Layout

Title  
Sign In

Fields

Email  
Password

Primary Button  
Sign In

Links

Forgot password  
Create organization  
Join with invite

---

## Behavior

If login successful:

Redirect to:

Home Dashboard

---

# 4. Signup Screen

Route:

/signup

Purpose:

Create a new organization and first admin user.

---

## Step 1 – Account Details

Fields

Full name  
Email  
Password

Continue

---

## Step 2 – Organization Setup

Fields

Organization name  
Organization type  
Country  
Default currency

Continue

---

## Step 3 – Workspace Ready

Display confirmation screen.

Message:

Your organization workspace is ready.

Button:

Go to dashboard

---

# 5. Invite Flow

Route:

/invite/:token

Purpose:

Allow invited users to join an existing organization.

---

## Layout

Title  
Join Organization

Display

Organization name  
Invited by (optional)

Fields

Full name  
Email  
Password

Primary Button

Join Workspace

---

## Behavior

After successful join:

User is redirected to:

Home dashboard

---

# 6. Password Reset

Route:

/reset-password

Fields

Email

Action

Send reset link

---

## Reset Flow

User receives email link:

/reset-password/:token

Fields

New password  
Confirm password

Button

Reset password

---

# 7. Authentication States

The application has three main states.

### Unauthenticated

User must see:

Welcome / Login / Signup

---

### Invited

User sees:

Invite screen

---

### Authenticated

User redirected to:

Dashboard

---

# 8. Session Handling

Session stored via:

Supabase Auth

On refresh:

Check session token.

If valid:

Auto redirect to dashboard.

If invalid:

Return to login.

---

# 9. Mobile Design Rules

Authentication screens must remain minimal.

Rules:

- One primary action per screen
- Avoid multiple buttons
- Use full width buttons
- Keep text concise
- No complex navigation

---

# 10. Security

Passwords must be:

Minimum 8 characters

Authentication handled by:

Supabase Auth

Email verification recommended for new accounts.

---

# End Spec