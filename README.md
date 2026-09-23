# DSSE Co-Working Booking Portal

Booking portal for the Desai Sethi School of Entrepreneurship (DSSE) co-working floor at IIT Bombay. It replaces a manual form: venture teams book numbered workstations, and staff approve, manage users, and report usage.

The floor has **55 numbered seats** in a fishbone layout (10 clusters). Hours, quotas, and guidelines are enforced on the API and configurable by admins.

## Repository layout

```
.
├── backend/                 FastAPI app (server.py, auth, policy, mailer, seed)
│   ├── tests/               API tests and policy unit tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                React app (Create React App + CRACO)
│   ├── src/pages/           Public, member, and admin screens
│   ├── src/components/      Layout, floor map, guidelines modal, shadcn/ui
│   ├── src/lib/             API client and auth
│   └── Dockerfile           Production build served by nginx
├── deploy/                  nginx config and AWS demo notes
├── scripts/
│   ├── dev.sh               Local Mongo + API + frontend
│   ├── aws-demo-up.sh       Public EC2 demo
│   └── aws-demo-down.sh     Tear the demo down
├── invent-site/             Separate Cloudflare Worker for iitbinvent.com
├── docker-compose.yml       Local MongoDB only
├── docker-compose.prod.yml  nginx + API + MongoDB
├── design_guidelines.json   Visual tokens (navy, amber, type)
└── memory/PRD.md            Earlier product notes (paths and scope have moved on)
```

## Stack

| Layer | What it uses |
| --- | --- |
| UI | React 19, React Router 7, Tailwind, Radix/shadcn, Recharts, Sonner |
| API | FastAPI, Pydantic, Motor (async MongoDB) |
| Auth | JWT in httpOnly cookies, plus a Bearer token returned at login |
| Data | MongoDB 7 |
| Mail | Resend, SMTP, or Amazon SES (logs the message if none is set) |
| Prod UI | nginx proxies `/api` to the API and serves the React build |

The frontend talks to `{REACT_APP_BACKEND_URL}/api`. In local dev that is `http://localhost:8000`. A production build leaves the URL empty so the browser calls same-origin `/api`.

## Roles

| Role | Access |
| --- | --- |
| `super_admin` | Same admin surfaces as `admin`. Seeded from `ADMIN_EMAIL` |
| `admin` | Approvals, users, teams, seats, violations, reports, guidelines, configuration |
| `team_lead` | Books for themselves and consecutive seats for the team |
| `member` | Books their own seat under the team quota |
| `applicant` | Signed up, pending staff approval; cannot use the workspace |

Self-serve signup accepts `@iitb.ac.in` and `@iitbombay.org` (override with `MEMBER_EMAIL_DOMAINS`). New accounts stay `pending` until an admin assigns a team. The configured admin mailbox (`ADMIN_EMAIL`) is the only account that may hold an admin role.

## What members and staff can do

**Members**

- Dashboard with team quota and upcoming bookings
- Book a seat on the floor map or timeline (IST working hours)
- Team leads can book consecutive seats in one cluster for several members; those hours count once against the team quota
- My bookings, team, and profile (including password change)
- In-app notifications
- Guidelines must be accepted before the workspace is usable

**Staff**

- Approve or reject signups and bookings (including bulk approve)
- Users and teams, with CSV import
- Seat map: mark seats maintenance or blocked
- Violation log (tier 3 suspends the account)
- Versioned guidelines
- Reports: dashboard KPIs, 14-day chart, seat-hour utilization, team usage, CSV export
- Configuration: working hours, daily / weekly / monthly caps, slot length, booking window, programs that auto-approve

Seeded defaults (applied only when configuration does not exist yet): 09:00–18:00 IST, 1–4 hours per slot, 4 hours/day, 20 hours/week, 80 hours/month, bookings up to 7 days ahead. Programs seeded with demo teams: `ideas_l1`, `ideas_l2`, `groww`.

## Local development

Requirements: Python 3.11, Node.js 20, Yarn 1, and Docker (for MongoDB).

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Create `backend/.env` (this file is gitignored):

```bash
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=coworking
JWT_SECRET=replace-with-a-long-random-string
ADMIN_EMAIL=ideas.iitb@gmail.com
ADMIN_PASSWORD=Admin@123
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

Install the UI, then start everything from the repo root:

```bash
cd frontend && yarn install
cd ..
make dev
```

`make dev` runs `scripts/dev.sh`: it starts MongoDB with `docker compose`, waits until it answers, starts uvicorn on port 8000 with reload, then `yarn start` on port 3000.

- App: http://localhost:3000
- API: http://localhost:8000 (`GET /` returns the service name)
- API docs: http://localhost:8000/docs

On first startup the API seeds 55 seats, guidelines v1, default configuration, three demo teams, and the super admin. Change `ADMIN_PASSWORD` and `JWT_SECRET` before sharing a deployment. Set `ADMIN_SYNC_ON_START=true` if an existing user with `ADMIN_EMAIL` should be reset to that super-admin password.

If no mail provider is configured, login and password-reset OTP codes are returned in the API response and logged, so local sign-in still works.

## Environment

| Variable | Used by | Purpose |
| --- | --- | --- |
| `MONGO_URL` | API | Mongo connection string |
| `DB_NAME` | API | Database name (`coworking` by default in Compose) |
| `JWT_SECRET` | API | Required. Signs access and refresh tokens |
| `ADMIN_EMAIL` | API | Super-admin mailbox (default `ideas.iitb@gmail.com`) |
| `ADMIN_PASSWORD` | API | Password used when that admin is created |
| `ADMIN_SYNC_ON_START` | API | `true` rewrites the admin password and role on boot |
| `MEMBER_EMAIL_DOMAIN` | API | Primary member domain (`iitb.ac.in`) |
| `MEMBER_EMAIL_DOMAINS` | API | Comma-separated signup domains |
| `CORS_ORIGINS` | API | Comma-separated browser origins allowed to send cookies |
| `RESEND_API_KEY`, `RESEND_FROM` | Mail | Preferred mail provider when set |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Mail | Used when Resend is not set |
| `SES_FROM`, `AWS_REGION` | Mail | Amazon SES when neither Resend nor SMTP is set |
| `REACT_APP_BACKEND_URL` | Frontend | API origin in dev; empty in the Docker image |

## Tests

Policy checks do not need a running server:

```bash
cd backend
.venv/bin/pytest tests/test_policy.py
```

API tests need the server and MongoDB up (`make dev` in another terminal):

```bash
cd backend
.venv/bin/pytest tests/test_dsse_backend.py
```

## Production-shaped local stack

nginx on port 80, the API, and MongoDB:

```bash
export JWT_SECRET=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
docker compose -f docker-compose.prod.yml up --build
```

Open http://localhost/. The UI and `/api` share one origin. See `deploy/README.md` for the AWS EC2 + CloudFront demo (`scripts/aws-demo-up.sh` / `scripts/aws-demo-down.sh`).

## INVENT site

`invent-site/` is a separate Cloudflare Worker (`iitbinvent`) for the INVENT / DSSE Day page on `iitbinvent.com`. It is not part of the booking app.

```bash
cd invent-site
npm install
npm run dev      # wrangler dev
npm run deploy   # wrangler deploy
```

## Frontend routes

Public: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/guidelines`.

Members: `/dashboard`, `/book`, `/bookings`, `/team`, `/profile`.

Admin: `/admin`, `/admin/approvals`, `/admin/users`, `/admin/teams`, `/admin/seats`, `/admin/violations`, `/admin/reports`, `/admin/guidelines`, `/admin/configuration`.
