import os
import re
import sqlite3
from functools import wraps
from datetime import date
from typing import Any, Dict, Optional

from flask import Flask, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash


APP_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(APP_DIR, "mess.db")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def create_app() -> Flask:
    app = Flask(__name__)
    app.json.sort_keys = False
    app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-secret-change-me")

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

    def parse_int_query(name: str, default: int, min_value: int, max_value: int) -> int:
        raw = request.args.get(name, None)
        if raw is None or str(raw).strip() == "":
            return default
        try:
            value = int(raw)
        except (TypeError, ValueError):
            return default
        return max(min_value, min(value, max_value))

    def member_exists(conn: sqlite3.Connection, member_id: int) -> bool:
        row = conn.execute("SELECT 1 FROM members WHERE id = ?", (member_id,)).fetchone()
        return row is not None

    def is_logged_in() -> bool:
        return bool(session.get("user_id"))

    def login_required(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not is_logged_in():
                if request.path.startswith("/api/"):
                    return jsonify({"error": "Authentication required"}), 401
                return redirect(url_for("login", next=request.full_path))
            return fn(*args, **kwargs)

        return wrapper

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

    @app.get("/login")
    def login():
        if is_logged_in():
            return redirect(url_for("manager"))
        return render_template("login.html", next=request.args.get("next", ""))

    @app.post("/login")
    def login_post():
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        next_url = request.form.get("next") or ""

        if not username or not password:
            return render_template("login.html", error="Username and password are required.", next=next_url), 400

        conn = get_db()
        try:
            user = conn.execute(
                "SELECT id, username, password_hash, role FROM users WHERE username = ?",
                (username,),
            ).fetchone()
        except sqlite3.OperationalError:
            return (
                render_template(
                    "login.html",
                    error="Login table missing. Run `python3 init_db.py --reset` to initialize the database.",
                    next=next_url,
                ),
                500,
            )

        if user is None or not check_password_hash(user["password_hash"], password):
            return render_template("login.html", error="Invalid credentials.", next=next_url), 401

        session.clear()
        session["user_id"] = int(user["id"])
        session["username"] = user["username"]
        session["role"] = user["role"]

        if next_url and next_url.startswith("/"):
            return redirect(next_url)
        return redirect(url_for("manager"))

    @app.post("/logout")
    def logout():
        session.clear()
        return redirect(url_for("index"))

    @app.get("/manager")
    @login_required
    def manager():
        return render_template("manager.html", username=session.get("username", ""))

    @app.get("/api/session")
    def api_session():
        return jsonify(
            {
                "logged_in": is_logged_in(),
                "username": session.get("username"),
                "role": session.get("role"),
            }
        )

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

    @app.post("/api/members")
    @login_required
    def api_add_member():
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        if len(name) > 80:
            return jsonify({"error": "name is too long (max 80 chars)"}), 400

        conn = get_db()
        try:
            conn.execute("INSERT INTO members(name) VALUES (?)", (name,))
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "Member name already exists"}), 409
        return jsonify({"ok": True})

    @app.put("/api/members/<int:member_id>")
    @login_required
    def api_update_member(member_id: int):
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name is required"}), 400
        if len(name) > 80:
            return jsonify({"error": "name is too long (max 80 chars)"}), 400

        conn = get_db()
        if not member_exists(conn, member_id):
            return jsonify({"error": "Member not found"}), 404
        try:
            conn.execute("UPDATE members SET name = ? WHERE id = ?", (name, member_id))
            conn.commit()
        except sqlite3.IntegrityError:
            return jsonify({"error": "Member name already exists"}), 409
        return jsonify({"ok": True})

    @app.delete("/api/members/<int:member_id>")
    @login_required
    def api_delete_member(member_id: int):
        conn = get_db()
        if not member_exists(conn, member_id):
            return jsonify({"error": "Member not found"}), 404
        conn.execute("DELETE FROM members WHERE id = ?", (member_id,))
        conn.commit()
        return jsonify({"ok": True})

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
    @login_required
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

    @app.get("/api/meals")
    def api_list_meals():
        limit = parse_int_query("limit", 200, 1, 1000)
        offset = parse_int_query("offset", 0, 0, 1_000_000)

        conn = get_db()
        rows = conn.execute(
            """
            SELECT meals.id, meals.date, meals.member_id, meals.meal_count, members.name AS member_name
            FROM meals
            JOIN members ON members.id = meals.member_id
            ORDER BY meals.date DESC, meals.id DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(
            {
                "meals": [
                    {
                        "id": r["id"],
                        "date": r["date"],
                        "member_id": r["member_id"],
                        "member_name": r["member_name"],
                        "meal_count": float(r["meal_count"]),
                    }
                    for r in rows
                ]
            }
        )

    @app.put("/api/meals/<int:meal_id>")
    @login_required
    def api_update_meal(meal_id: int):
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

        cur = conn.execute("UPDATE meals SET date = ?, member_id = ?, meal_count = ? WHERE id = ?",
                           (meal_date, member_id, meal_count, meal_id))
        if cur.rowcount == 0:
            return jsonify({"error": "Meal entry not found"}), 404
        conn.commit()
        return jsonify({"ok": True})

    @app.delete("/api/meals/<int:meal_id>")
    @login_required
    def api_delete_meal(meal_id: int):
        conn = get_db()
        cur = conn.execute("DELETE FROM meals WHERE id = ?", (meal_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Meal entry not found"}), 404
        conn.commit()
        return jsonify({"ok": True})

    @app.post("/api/add_bazar")
    @login_required
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

    @app.get("/api/bazar")
    def api_list_bazar():
        limit = parse_int_query("limit", 200, 1, 1000)
        offset = parse_int_query("offset", 0, 0, 1_000_000)

        conn = get_db()
        rows = conn.execute(
            """
            SELECT bazar.id, bazar.date, bazar.member_id, bazar.amount, bazar.description, members.name AS member_name
            FROM bazar
            JOIN members ON members.id = bazar.member_id
            ORDER BY bazar.date DESC, bazar.id DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(
            {
                "bazar": [
                    {
                        "id": r["id"],
                        "date": r["date"],
                        "member_id": r["member_id"],
                        "member_name": r["member_name"],
                        "amount": float(r["amount"]),
                        "description": r["description"] or "",
                    }
                    for r in rows
                ]
            }
        )

    @app.put("/api/bazar/<int:expense_id>")
    @login_required
    def api_update_bazar(expense_id: int):
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

        cur = conn.execute(
            "UPDATE bazar SET date = ?, member_id = ?, amount = ?, description = ? WHERE id = ?",
            (bazar_date, member_id, amount, description, expense_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Expense entry not found"}), 404
        conn.commit()
        return jsonify({"ok": True})

    @app.delete("/api/bazar/<int:expense_id>")
    @login_required
    def api_delete_bazar(expense_id: int):
        conn = get_db()
        cur = conn.execute("DELETE FROM bazar WHERE id = ?", (expense_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Expense entry not found"}), 404
        conn.commit()
        return jsonify({"ok": True})

    @app.post("/api/add_deposit")
    @login_required
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

    @app.get("/api/deposits")
    def api_list_deposits():
        limit = parse_int_query("limit", 200, 1, 1000)
        offset = parse_int_query("offset", 0, 0, 1_000_000)

        conn = get_db()
        rows = conn.execute(
            """
            SELECT deposits.id, deposits.date, deposits.member_id, deposits.amount, members.name AS member_name
            FROM deposits
            JOIN members ON members.id = deposits.member_id
            ORDER BY deposits.date DESC, deposits.id DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset),
        ).fetchall()
        return jsonify(
            {
                "deposits": [
                    {
                        "id": r["id"],
                        "date": r["date"],
                        "member_id": r["member_id"],
                        "member_name": r["member_name"],
                        "amount": float(r["amount"]),
                    }
                    for r in rows
                ]
            }
        )

    @app.put("/api/deposits/<int:deposit_id>")
    @login_required
    def api_update_deposit(deposit_id: int):
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

        cur = conn.execute(
            "UPDATE deposits SET date = ?, member_id = ?, amount = ? WHERE id = ?",
            (deposit_date, member_id, amount, deposit_id),
        )
        if cur.rowcount == 0:
            return jsonify({"error": "Deposit entry not found"}), 404
        conn.commit()
        return jsonify({"ok": True})

    @app.delete("/api/deposits/<int:deposit_id>")
    @login_required
    def api_delete_deposit(deposit_id: int):
        conn = get_db()
        cur = conn.execute("DELETE FROM deposits WHERE id = ?", (deposit_id,))
        if cur.rowcount == 0:
            return jsonify({"error": "Deposit entry not found"}), 404
        conn.commit()
        return jsonify({"ok": True})

    return app


app = create_app()


if __name__ == "__main__":
    # Ensure DB exists for first-time runs.
    if not os.path.exists(DB_PATH):
        print("Database not found. Run `python3 init_db.py` first to create `mess.db`.")
    app.run(host="127.0.0.1", port=5000, debug=True)
