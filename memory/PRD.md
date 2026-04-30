# DSSE Co-Working Space Booking Portal — PRD

## Original Problem Statement
Build a co-working space booking portal for the **Desai Sethi School of Entrepreneurship (DSSE) at IIT Bombay**, 4th floor, **55 numbered workstations**. Replaces a manual Google Form. Different student venture teams (IDEAS L1, IDEAS L2, Groww, individual) book seats; every booking needs admin approval.

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + recharts + sonner. Path alias `@` → `src/`.
- **Backend**: FastAPI + MongoDB (motor). All routes prefixed `/api`.
- **Auth**: JWT (PyJWT) with httpOnly cookies (`access_token`, `refresh_token`) + Bearer fallback. bcrypt password hashing.
- **Stack adapted from Supabase → MongoDB** because that is the available environment.

## User Personas / Roles
1. **Super Admin** (faculty) — sees and configures everything.
2. **Admin** (program staff) — approvals, user/team management, violations.
3. **Team Lead** — books on behalf of team.
4. **Member** — books for themselves under team quota.
5. **Applicant** — pending review; read-only access until approved.

## Core Requirements (static)
- 55 numbered workstations on the 4th floor (fishbone layout — 10 clusters).
- Bookings hourly between 9 AM–6 PM, max 4h/day, max 20h/week (per team, configurable).
- 1-hour lead time, 7-day booking window.
- Every booking needs admin approval.
- Pre-issued credentials AND public sign-up flow.
- Guidelines acceptance modal blocks dashboard until accepted.
- Must work on phone (375px wide).

## Implemented (2026-04-30)
### Backend (`/app/backend`)
- `auth.py` — JWT helpers, bcrypt, cookie management, `get_current_user` dependency factory.
- `seed.py` — builds 55-seat fishbone layout (right: 1-6, 7-12, 13-18, 19-23 with pillar=5, 24-29, 30-35; left: 51-55, 46-50, 41-45, 36-40), super-admin, 3 demo teams (Lumen Ventures/Bharat Robotics/GrowwLabs Alpha), default config, default guidelines v1.
- `server.py` — full REST API:
  - **Auth**: register, login, logout, me, refresh, forgot-password, reset-password, accept-guidelines.
  - **Users (admin)**: list, create, approve applicant (with team assignment), reject, status update.
  - **Teams**: list, create, detail, **CSV import (dry-run preview + confirm)**, add member.
  - **Seats**: list, update (admin), day overview.
  - **Bookings**: create (with full 10-rule validation), my bookings, cancel, day overview, pending list (sorted by tier+time), approve, reject, **bulk approve**.
  - **Violations**: list, create (auto-action: tier_3 suspends).
  - **Guidelines**: active, list, create version, activate.
  - **Configuration**: get, update.
  - **Notifications**: in-app bell with read tracking.
  - **Reports**: admin dashboard KPIs + 14-day chart, utilization heatmap (seat × hour), team usage, CSV export.
- All 10 booking rules enforced server-side with friendly error messages.

### Frontend (`/app/frontend/src`)
- **Public**: Landing (hero with floor preview SVG, "How it works", programs, footer), Login (split-screen with imagery), Signup, Forgot/Reset Password, Guidelines page.
- **Member**: Dashboard (quota bar, upcoming bookings, team card), **Book** (date tabs + Floor Map view + Timeline view + side drawer with hourly grid + booking summary), My Bookings (tabs: Upcoming/Past/Cancelled with cancel), My Team, Profile (info + change password).
- **Admin**: Dashboard (KPI cards + 14-day line chart), Approvals (table with bulk + reject reason), Users (filters, create modal, approve modal with team assignment, suspend/reactivate), Teams (table + create + CSV import with preview), Seats (interactive floor map + maintenance toggle), Violations (log form with tier severity), Reports (team usage bar chart + utilization heatmap + CSV export), Guidelines (versioned editor with markdown), Configuration (working hours, caps, auto-approve programs).
- `FloorMap.jsx` — interactive 55-seat SVG with fishbone clusters, gate, pillar, 4 color states (available/partial/full/maintenance).
- `Layout.jsx` — sticky header with notifications bell + role-aware sidebar nav.
- `GuidelinesAcceptModal.jsx` — blocks dashboard until latest version accepted.

### Design System
- Navy `#1B2A4E` + Amber `#E8A33D` + Off-white `#FAFAF7`.
- **Source Serif 4** (headlines) + **Inter** (UI).
- `rounded-xl`, subtle shadows, no heavy gradients.
- All interactive elements have `data-testid`.

## Test Results (iteration 1)
- **Backend: 39/39 pytest tests pass** (auth, seats, config, teams, RBAC, booking rules, approvals, dashboard, violations, guidelines).
- **Frontend: 100% pages render** (smoke-tested all 17 pages).
- Bug found and fixed: register response leaked MongoDB `_id`.
- Super admin login + redirect verified.

## What's Deferred (Phase 2)
- **P0**: Resend email notifications (currently in-app only) — needs API key from user.
- **P1**: Brute-force lockout on login (5-fail / 15-min, per playbook).
- **P1**: Production CORS — replace `allow_origins=["*"]` with explicit `FRONTEND_URL` so cookies work cross-origin in prod.
- **P2**: Drag-to-reposition seats in the visual editor (currently click-to-edit zone/maintenance).
- **P2**: No-show auto-detection (when user doesn't check in within 30 min of slot start).
- **P2**: Calendar-style monthly view in My Bookings.
- **P2**: Mobile QR-code check-in at the workstation.

## Next Tasks
1. Connect Resend (or other email provider) for notification emails.
2. Add booking reminder email 1 hour before slot.
3. Consider auto-approval rules per program (already supported in config — needs UI surfacing on individual programs).
4. Add brute-force lockout middleware on login.

## Test Credentials
See `/app/memory/test_credentials.md`.
- Super admin: `ideas.iitb@gmail.com` / `Admin@123`
