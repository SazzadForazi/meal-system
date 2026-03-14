import express from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const membersRouter = express.Router();

membersRouter.use(authRequired, requireRole(["mess_admin"]));

membersRouter.get("/", async (req, res) => {
  const messId = req.user.mess_id;
  const r = await query(
    "SELECT id,name,mess_id,join_date,status FROM members WHERE mess_id=$1 ORDER BY status ASC, name ASC",
    [messId]
  );
  return res.json({ members: r.rows });
});

membersRouter.post("/", async (req, res) => {
  const messId = req.user.mess_id;
  const { name, join_date } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  try {
    const r = await query(
      "INSERT INTO members(name,mess_id,join_date,status) VALUES ($1,$2,COALESCE($3::date,CURRENT_DATE),'active') RETURNING id,name,mess_id,join_date,status",
      [String(name), messId, join_date || null]
    );
    return res.json({ member: r.rows[0] });
  } catch (e) {
    if (String(e?.code) === "23505") return res.status(409).json({ error: "Member already exists" });
    throw e;
  }
});

membersRouter.put("/:id", async (req, res) => {
  const messId = req.user.mess_id;
  const { id } = req.params;
  const { name, status } = req.body || {};
  const r = await query(
    "UPDATE members SET name=COALESCE($1,name), status=COALESCE($2,status) WHERE id=$3 AND mess_id=$4 RETURNING id,name,mess_id,join_date,status",
    [name ? String(name) : null, status ? String(status) : null, id, messId]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Member not found" });
  return res.json({ member: r.rows[0] });
});

