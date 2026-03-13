import os
import re
import sqlite3
from datetime import date
from typing import Any, Dict, Optional

from flask import Flask, g, jsonify, render_template, request


APP_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(APP_DIR, "mess.db")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def create_app() -> Flask:
    app = Flask(__name__)
    app.json.sort_keys = False

    # One SQLite connection per request (stored on Flask's `g`).
    def get_db() -> sqlite3.Connection:
        conn: Optional[sqlite3.Connection] = getattr(g, "_db", None)
        if conn is None:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            g._db = conn
        return conn

    @app.teardown_appcontext
    def close_db(_: Optional[BaseException]) -> None:
        conn = getattr(g, "_db", None)
        if conn is not None:
            conn.close()

    def parse_iso_date(value: Optional[str]) -> str:
        if value is None or value.strip() == "":
            return date.today().isoformat()
        value = value.strip()
        if not DATE_RE.match(value):
            raise ValueError("date must be in YYYY-MM-DD format")
        return value

    def parse_positive_float(value: Any, field: str) -> float:
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{field} must be a number")
        if num < 0:
            raise ValueError(f"{field} must be >= 0")
        return num

    def member_exists(conn: sqlite3.Connection, member_id: int) -> bool:
        row = conn.execute("SELECT 1 FROM members WHERE id = ?", (member_id,)).fetchone()
        return row is not None

    def compute_summary(conn: sqlite3.Connection) -> Dict[str, float]:
        total_meals = (
            conn.execute("SELECT COALESCE(SUM(meal_count), 0) AS v FROM meals").fetchone()["v"]
        )
        total_expenses = (
            conn.execute("SELECT COALESCE(SUM(amount), 0) AS v FROM bazar").fetchone()["v"]
        )
        total_deposits = (
            conn.execute("SELECT COALESCE(SUM(amount), 0) AS v FROM deposits").fetchone()["v"]
        )

        total_meals = float(total_meals or 0.0)
        total_expenses = float(total_expenses or 0.0)
        total_deposits = float(total_deposits or 0.0)
        meal_rate = (total_expenses / total_meals) if total_meals > 0 else 0.0

        return {
            "total_meals": total_meals,
            "total_expenses": total_expenses,
            "meal_rate": meal_rate,
            "total_deposits": total_deposits,
        }

    @app.get("/")
    def index():
        return render_template("index.html")

    # Summary: totals + global meal rate (expenses / meals).
    @app.get("/api/summary")
    def api_summary():
        conn = get_db()
        return jsonify(compute_summary(conn))

    # Member list for populating dropdowns and the dashboard table.
    @app.get("/api/members")
    def api_members():
        conn = get_db()
        rows = conn.execute("SELECT id, name FROM members ORDER BY name").fetchall()
        return jsonify({"members": [{"id": r["id"], "name": r["name"]} for r in rows]})

    # Member financial stats computed using the current global meal rate.
    @app.get("/api/member_stats/<int:member_id>")
    def api_member_stats(member_id: int):
        conn = get_db()
        member = conn.execute("SELECT id, name FROM members WHERE id = ?", (member_id,)).fetchone()
        if member is None:
            return jsonify({"error": "Member not found"}), 404

        summary = compute_summary(conn)
        meal_rate = summary["meal_rate"]

        total_meals = conn.execute(
            "SELECT COALESCE(SUM(meal_count), 0) AS v FROM meals WHERE member_id = ?",
            (member_id,),
        ).fetchone()["v"]
        total_deposit = conn.execute(
            "SELECT COALESCE(SUM(amount), 0) AS v FROM deposits WHERE member_id = ?",
            (member_id,),
        ).fetchone()["v"]

        total_meals = float(total_meals or 0.0)
        total_deposit = float(total_deposit or 0.0)
        total_cost = total_meals * meal_rate
        balance = total_deposit - total_cost

        return jsonify(
            {
                "member": {"id": member["id"], "name": member["name"]},
                "total_meals": total_meals,
                "total_deposit": total_deposit,
                "meal_rate": meal_rate,
                "total_cost": total_cost,
                "balance": balance,
            }
        )

    @app.post("/api/add_meal")
    def api_add_meal():
        data = request.get_json(silent=True) or {}
        try:
            member_id = int(data.get("member_id"))
            meal_count = parse_positive_float(data.get("meal_count"), "meal_count")
            meal_date = parse_iso_date(data.get("date"))
        except (TypeError, ValueError) as exc:
            return jsonify({"error": str(exc)}), 400

        conn = get_db()
        if not member_exists(conn, member_id):
            return jsonify({"error": "Member not found"}), 404

        conn.execute(
            "INSERT INTO meals(date, member_id, meal_count) VALUES (?, ?, ?)",
            (meal_date, member_id, meal_count),
        )
        conn.commit()
        return jsonify({"ok": True})

    @app.post("/api/add_bazar")
    def api_add_bazar():
        data = request.get_json(silent=True) or {}
        try:
            member_id = int(data.get("member_id"))
            amount = parse_positive_float(data.get("amount"), "amount")
            bazar_date = parse_iso_date(data.get("date"))
            description = (data.get("description") or "").strip()
            if len(description) > 500:
                raise ValueError("description is too long (max 500 chars)")
        except (TypeError, ValueError) as exc:
            return jsonify({"error": str(exc)}), 400

        conn = get_db()
        if not member_exists(conn, member_id):
            return jsonify({"error": "Member not found"}), 404

        conn.execute(
            "INSERT INTO bazar(date, member_id, amount, description) VALUES (?, ?, ?, ?)",
            (bazar_date, member_id, amount, description),
        )
        conn.commit()
        return jsonify({"ok": True})

    @app.post("/api/add_deposit")
    def api_add_deposit():
        data = request.get_json(silent=True) or {}
        try:
            member_id = int(data.get("member_id"))
            amount = parse_positive_float(data.get("amount"), "amount")
            deposit_date = parse_iso_date(data.get("date"))
        except (TypeError, ValueError) as exc:
            return jsonify({"error": str(exc)}), 400

        conn = get_db()
        if not member_exists(conn, member_id):
            return jsonify({"error": "Member not found"}), 404

        conn.execute(
            "INSERT INTO deposits(date, member_id, amount) VALUES (?, ?, ?)",
            (deposit_date, member_id, amount),
        )
        conn.commit()
        return jsonify({"ok": True})

    return app


app = create_app()


if __name__ == "__main__":
    # Ensure DB exists for first-time runs.
    if not os.path.exists(DB_PATH):
        print("Database not found. Run `python init_db.py` first to create `mess.db`.")
    app.run(host="127.0.0.1", port=5000, debug=True)
