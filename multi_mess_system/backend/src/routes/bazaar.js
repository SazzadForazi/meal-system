import express from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const bazaarRouter = express.Router();

bazaarRouter.get("/", authRequired, async (req, res) => {
  const messId = req.user.mess_id;
  const r = await query(
    "SELECT id,mess_id,member_id,amount,description,date FROM bazaar WHERE mess_id=$1 ORDER BY date DESC",
    [messId]
  );
  return res.json({ bazaar: r.rows });
});

bazaarRouter.post("/", authRequired, requireRole(["mess_admin"]), async (req, res) => {
  const messId = req.user.mess_id;
  const { amount, description, date, member_id } = req.body || {};
  const num = Number(amount);
  if (!Number.isFinite(num) || num < 0) return res.status(400).json({ error: "amount must be >= 0" });
  if (!date) return res.status(400).json({ error: "date required" });

  const r = await query(
    "INSERT INTO bazaar(mess_id,member_id,amount,description,date) VALUES ($1,$2,$3,$4,$5::date) RETURNING id,mess_id,member_id,amount,description,date",
    [messId, member_id || null, num, String(description || ""), date]
  );
  return res.json({ entry: r.rows[0] });
});

