import express from "express";
import { query } from "../db.js";

export const publicRouter = express.Router();

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

publicRouter.post("/mess-requests", async (req, res) => {
  const { mess_name, requester_name, requester_email, message } = req.body || {};

  const messName = String(mess_name || "").trim();
  const requesterName = String(requester_name || "").trim();
  const requesterEmail = normEmail(requester_email);
  const msg = String(message || "").trim();

  if (!messName) return res.status(400).json({ error: "mess_name required" });
  if (!requesterName) return res.status(400).json({ error: "requester_name required" });
  if (!requesterEmail) return res.status(400).json({ error: "requester_email required" });
  if (messName.length > 120) return res.status(400).json({ error: "mess_name too long" });
  if (requesterName.length > 120) return res.status(400).json({ error: "requester_name too long" });
  if (requesterEmail.length > 180) return res.status(400).json({ error: "requester_email too long" });
  if (msg.length > 800) return res.status(400).json({ error: "message too long" });

  const r = await query(
    `
    INSERT INTO mess_requests(mess_name, requester_name, requester_email, message, status)
    VALUES ($1,$2,$3,$4,'pending')
    RETURNING id, mess_name, requester_name, requester_email, message, status, created_at
    `,
    [messName, requesterName, requesterEmail, msg]
  );

  return res.json({ request: r.rows[0] });
});

