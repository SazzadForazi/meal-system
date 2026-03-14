import express from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const mealsRouter = express.Router();

function monthStartEnd(month) {
  const [y, m] = month.split("-").map((x) => Number(x));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const toIso = (d) => d.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
}

mealsRouter.get("/matrix", authRequired, async (req, res) => {
  const month = String(req.query.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "month must be YYYY-MM" });

  const messId = req.user.mess_id;
  if (!messId) return res.status(400).json({ error: "User has no mess_id" });

  const { start, end } = monthStartEnd(month);

  // Active in month: active members who joined on/before month end.
  const members = await query(
    "SELECT id,name FROM members WHERE mess_id=$1 AND status='active' AND join_date <= $2::date ORDER BY name",
    [messId, end]
  );

  const entries = await query(
    "SELECT member_id, date, meal_count FROM meals WHERE mess_id=$1 AND date >= $2::date AND date <= $3::date ORDER BY date ASC",
    [messId, start, end]
  );

  return res.json({ month, members: members.rows, entries: entries.rows });
});

mealsRouter.post("/matrix", authRequired, requireRole(["mess_admin"]), async (req, res) => {
  const { month, entries } = req.body || {};
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return res.status(400).json({ error: "month must be YYYY-MM" });
  if (!Array.isArray(entries)) return res.status(400).json({ error: "entries must be a list" });

  const messId = req.user.mess_id;
  const { start, end } = monthStartEnd(month);

  await query("BEGIN", []);
  try {
    for (const e of entries) {
      const memberId = e.member_id;
      const date = e.date;
      const mealCount = e.meal_count;

      if (!memberId || !date) throw new Error("Invalid entry");
      if (date < start || date > end) throw new Error("Date outside month");

      // Null/empty or 0 means delete
      if (mealCount == null || Number(mealCount) === 0) {
        await query("DELETE FROM meals WHERE mess_id=$1 AND member_id=$2 AND date=$3::date", [
          messId,
          memberId,
          date,
        ]);
        continue;
      }

      const num = Number(mealCount);
      if (!Number.isFinite(num) || num < 0) throw new Error("Invalid meal_count");

      await query(
        `
        INSERT INTO meals(mess_id, member_id, date, meal_count)
        VALUES ($1,$2,$3::date,$4)
        ON CONFLICT (mess_id, member_id, date)
        DO UPDATE SET meal_count = EXCLUDED.meal_count
        `,
        [messId, memberId, date, num]
      );
    }
    await query("COMMIT", []);
  } catch (e) {
    await query("ROLLBACK", []);
    return res.status(400).json({ error: String(e.message || e) });
  }

  return res.json({ ok: true });
});

