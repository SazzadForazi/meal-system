import argparse
import os
import sqlite3
from datetime import date

from werkzeug.security import generate_password_hash


DB_PATH = os.path.join(os.path.dirname(__file__), "mess.db")


# Core schema for the mess system.
# Dates are stored as ISO strings (YYYY-MM-DD) to keep queries simple.
SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS members (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS meals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,
    member_id  INTEGER NOT NULL,
    meal_count REAL NOT NULL CHECK(meal_count >= 0),
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bazar (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT NOT NULL,
    member_id   INTEGER NOT NULL,
    amount      REAL NOT NULL CHECK(amount >= 0),
    description TEXT,
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS deposits (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    date      TEXT NOT NULL,
    member_id INTEGER NOT NULL,
    amount    REAL NOT NULL CHECK(amount >= 0),
    FOREIGN KEY(member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'manager',
    created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meals_member_id ON meals(member_id);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);
CREATE INDEX IF NOT EXISTS idx_bazar_member_id ON bazar(member_id);
CREATE INDEX IF NOT EXISTS idx_bazar_date ON bazar(date);
CREATE INDEX IF NOT EXISTS idx_deposits_member_id ON deposits(member_id);
CREATE INDEX IF NOT EXISTS idx_deposits_date ON deposits(date);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
"""


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db(db_path: str, seed: bool, seed_admin: bool) -> None:
    with connect(db_path) as conn:
        conn.executescript(SCHEMA_SQL)

        if seed_admin:
            # Seed a manager login (change via env vars for first run).
            mgr_user = os.environ.get("MESS_MANAGER_USER", "admin").strip() or "admin"
            mgr_pass = os.environ.get("MESS_MANAGER_PASS", "admin123")
            conn.execute(
                "INSERT OR IGNORE INTO users(username, password_hash, role, created_at) VALUES (?, ?, ?, ?)",
                (
                    mgr_user,
                    generate_password_hash(mgr_pass),
                    "manager",
                    date.today().isoformat(),
                ),
            )

        if seed:
            # Base member list (edit as needed).
            members = ["Sazzad", "Shakil", "Qurban", "Shifat", "Rabin"]
            conn.executemany(
                "INSERT OR IGNORE INTO members(name) VALUES (?)",
                [(name,) for name in members],
            )

            # Optional tiny seed so the dashboard isn't empty on first run.
            has_any_data = conn.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM meals) +
                    (SELECT COUNT(*) FROM bazar) +
                    (SELECT COUNT(*) FROM deposits)
                AS c
                """
            ).fetchone()[0]
            if int(has_any_data or 0) == 0:
                today = date.today().isoformat()
                member_rows = conn.execute("SELECT id, name FROM members ORDER BY id").fetchall()
                member_ids = {row[1]: row[0] for row in member_rows}

                conn.execute(
                    "INSERT INTO deposits(date, member_id, amount) VALUES (?, ?, ?)",
                    (today, member_ids["Sazzad"], 2000.0),
                )
                conn.execute(
                    "INSERT INTO deposits(date, member_id, amount) VALUES (?, ?, ?)",
                    (today, member_ids["Shakil"], 1500.0),
                )
                conn.execute(
                    "INSERT INTO meals(date, member_id, meal_count) VALUES (?, ?, ?)",
                    (today, member_ids["Sazzad"], 2.0),
                )
                conn.execute(
                    "INSERT INTO meals(date, member_id, meal_count) VALUES (?, ?, ?)",
                    (today, member_ids["Shakil"], 1.5),
                )
                conn.execute(
                    "INSERT INTO bazar(date, member_id, amount, description) VALUES (?, ?, ?, ?)",
                    (today, member_ids["Qurban"], 850.0, "Rice, lentils, veggies"),
                )


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize the Mess/Meal Management SQLite DB.")
    parser.add_argument(
        "--db",
        default=DB_PATH,
        help=f"Path to database file (default: {DB_PATH})",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing DB file before creating tables.",
    )
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="Do not insert sample members/data.",
    )
    parser.add_argument(
        "--no-admin",
        action="store_true",
        help="Do not create the default manager login.",
    )
    args = parser.parse_args()

    if args.reset and os.path.exists(args.db):
        os.remove(args.db)

    init_db(args.db, seed=not args.no_seed, seed_admin=not args.no_admin)
    print(f"Initialized database at: {args.db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
