# Multi-Mess Meal Management System (Node + Express + Postgres + React)

Supports multiple messes (hostels). Each mess has isolated data and its own admin + members.

## Stack

- Backend: Node.js + Express
- DB: PostgreSQL
- Frontend: React + Vite (no Next.js required)
- Auth: JWT + bcrypt

## Roles

- `super_admin`: create messes, assign mess admins, view all messes
- `mess_admin`: manage members, enter meals + bazaar, view reports
- `member`: view own meals and mess report

## Setup

## Requirements (Host Install)

- Node.js `>= 18` (recommended: 20 LTS)
- npm
- Podman or Docker (for PostgreSQL)

### 1) Start Everything (DB + Backend + Frontend)

```bash
cd multi_mess_system
podman-compose up -d
```

Podman notes:
- If you see `unknown shorthand flag: 'd' in -d`, your Podman compose wrapper likely doesn't support `-d`. Use: `podman compose up --detach` or `podman-compose up -d`.
- This project maps Postgres to host port `5433` (to avoid conflicts with a local Postgres on `5432`).
- Postgres automatically loads `backend/sql/schema.sql` on first boot (no manual `psql` needed).
- The backend uses `network_mode: host` to reliably connect to Postgres at `127.0.0.1:5433` on Linux systems running Podman.

If you already created the DB volume before schema changes, apply the latest schema manually:

```bash
cd multi_mess_system
podman exec -i multi_mess_system_db_1 psql -U mess -d mess_multi < backend/sql/schema.sql
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/health`

Note: the frontend supports React Router routes like `/dashboard` and `/auth/login` directly (Nginx SPA fallback is enabled).

## If Your Host Node Is Too Old (Example: Node 12)

Option A (recommended): install a newer Node (20 LTS) using `nvm`.

Option B: run Node using containers (no host Node/npm needed):

```bash
# Backend (uses host network so it can reach localhost:5433)
podman run --rm -it --network=host -v "$PWD/backend:/app" -w /app docker.io/library/node:20-bullseye \
  bash -lc "npm install && npm run dev"
```

```bash
# Frontend
podman run --rm -it --network=host -v "$PWD/frontend:/app" -w /app docker.io/library/node:20-bullseye \
  bash -lc "npm install && npm run dev -- --host 0.0.0.0"
```

## Seed super admin

The backend auto-seeds a Super Admin on startup if it doesn't exist. Configure via env vars:

- `SUPER_ADMIN_NAME`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

Defaults (see `backend/.env.example`):
- Email: `super@admin.com`
- Password: `superadmin1223`

## Mess Request Flow

1. New user opens `http://localhost:5173/request-mess` and submits a request with a message.
2. Super Admin logs in and approves the request in the Super Admin dashboard.
3. On approval, the system creates:
   - a new `mess` with a unique `mess_code`
   - a new `mess_admin` user
4. The UI shows the generated admin credentials once (email + password + mess code) so the Super Admin can send them to the mess admin.
