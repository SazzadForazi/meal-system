import express from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const reportsRouter = express.Router();

function monthStartEnd(month) {
  const [y, m] = month.split("-").map((x) => Number(x));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  const toIso = (d) => d.toISOString().slice(0, 10);
  return { start: toIso(start), end: toIso(end) };
}

reportsRouter.get("/monthly", authRequired, async (req, res) => {
  const month = String(req.query.month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "month must be YYYY-MM" });
  const messId = req.user.mess_id;
  const { start, end } = monthStartEnd(month);

  const members = await query(
    "SELECT id,name FROM members WHERE mess_id=$1 AND status='active' AND join_date <= $2::date ORDER BY name",
    [messId, end]
  );

  const meals = await query(
    `
    SELECT member_id, COALESCE(SUM(meal_count),0) AS total_meals
    FROM meals
    WHERE mess_id=$1 AND date >= $2::date AND date <= $3::date
    GROUP BY member_id
    `,
    [messId, start, end]
  );
  const mealMap = new Map(meals.rows.map((r) => [r.member_id, Number(r.total_meals)]));

  const baz = await query(
    "SELECT COALESCE(SUM(amount),0) AS total_bazaar FROM bazaar WHERE mess_id=$1 AND date >= $2::date AND date <= $3::date",
    [messId, start, end]
  );
  const totalBazaar = Number(baz.rows[0]?.total_bazaar || 0);

  const totalMeals = Array.from(mealMap.values()).reduce((a, b) => a + b, 0);
  const mealRate = totalMeals > 0 ? totalBazaar / totalMeals : 0;

  // "Contribution" modeled as bazaar spending per member (if member_id is set).
  const contrib = await query(
    `
    SELECT member_id, COALESCE(SUM(amount),0) AS contribution
    FROM bazaar
    WHERE mess_id=$1 AND date >= $2::date AND date <= $3::date AND member_id IS NOT NULL
    GROUP BY member_id
    `,
    [messId, start, end]
  );
  const contribMap = new Map(contrib.rows.map((r) => [r.member_id, Number(r.contribution)]));

  const rows = members.rows.map((m) => {
    const tm = mealMap.get(m.id) || 0;
    const cost = tm * mealRate;
    const contribution = contribMap.get(m.id) || 0;
    const balance = contribution - cost;
    return { member_id: m.id, name: m.name, total_meals: tm, cost, contribution, balance };
  });

  return res.json({ month, total_bazaar: totalBazaar, total_meals: totalMeals, meal_rate: mealRate, rows });
});

