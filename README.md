# Mess / Meal Management System (Flask + SQLite)

A lightweight web app to manage a bachelor mess: daily meals, bazar/expenses, and member deposits, with an automatically calculated meal rate and per-member balances.

## Tech Stack

- Backend: Python + Flask
- Database: SQLite3 (standard `sqlite3` library, no ORM)
- Frontend: HTML5, CSS3, Vanilla JavaScript

## Quick Start

### 1) Create a virtual environment (recommended)

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2) Install dependencies

```bash
pip install flask
```

### 3) Initialize the database

Creates `mess.db` and inserts sample members (and a small amount of demo data).

```bash
python3 init_db.py --reset
```

This also seeds a manager account (change via env vars before running `init_db.py`):

```bash
export MESS_MANAGER_USER=admin
export MESS_MANAGER_PASS=admin123
```

Options:

- `--no-seed`: creates tables without inserting sample data
- `--no-admin`: creates tables without creating the default manager user
- `--db /path/to/file.db`: choose a custom DB path

### 4) Run the server

```bash
export FLASK_SECRET_KEY="change-this-to-a-long-random-string"
python3 app.py
```

Open:

- `http://127.0.0.1:5000`
- `http://127.0.0.1:5000/login` (manager login)
- `http://127.0.0.1:5000/manager` (manager portal)

## Project Structure

```text
meal_system/
  app.py                 # Flask app + REST API
  init_db.py             # SQLite schema + seeding script
  mess.db                # SQLite DB (generated after init)
  templates/
    index.html           # Dashboard UI
    login.html           # Manager login
    manager.html         # Manager portal (CRUD)
  static/
    style.css            # Styling (responsive)
    script.js            # Frontend logic (fetch + DOM updates)
    manager.js           # Manager portal logic (CRUD)
```

## How It Works

- **Total meals** = sum of all `meals.meal_count`
- **Total expenses** = sum of all `bazar.amount`
- **Meal rate** = `total_expenses / total_meals` (0 if total meals is 0)
- **Member cost** = `member_total_meals * meal_rate`
- **Member balance** = `member_total_deposit - member_cost`
  - Positive = Advance
  - Negative = Due

## API Reference

All endpoints return JSON except `/` which renders HTML.

### `GET /`

Renders the main dashboard.

### `GET /api/summary`

Returns:

```json
{
  "total_meals": 0,
  "total_expenses": 0,
  "meal_rate": 0,
  "total_deposits": 0
}
```

### `GET /api/members`

Returns:

```json
{
  "members": [{ "id": 1, "name": "Sazzad" }]
}
```

### `GET /api/member_stats/<member_id>`

Returns:

```json
{
  "member": { "id": 1, "name": "Sazzad" },
  "total_meals": 0,
  "total_deposit": 0,
  "meal_rate": 0,
  "total_cost": 0,
  "balance": 0
}
```

### `POST /api/add_meal`

Body:

```json
{ "date": "2026-03-13", "member_id": 1, "meal_count": 2.5 }
```

### `POST /api/add_bazar`

Body:

```json
{
  "date": "2026-03-13",
  "member_id": 3,
  "amount": 850,
  "description": "Rice, lentils"
}
```

### `POST /api/add_deposit`

Body:

```json
{ "date": "2026-03-13", "member_id": 2, "amount": 1500 }
```

## Notes

- Dates are stored as ISO strings (`YYYY-MM-DD`).
- SQLite foreign keys are enabled via `PRAGMA foreign_keys = ON`.
- All write endpoints (add/edit/delete) require a manager login. The `/` dashboard loads in viewer mode when logged out.
- If you see “DB missing?” in the UI, run `python3 init_db.py --reset` and restart the server.
