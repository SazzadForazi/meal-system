import express from "express";
import bcrypt from "bcrypt";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";

export const adminRouter = express.Router();

adminRouter.use(authRequired, requireRole(["super_admin"]));

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomPassword() {
  // URL-safe-ish, easy to type. Not stored in DB plaintext; returned once on approval.
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 6);
}

adminRouter.get("/messes", async (_req, res) => {
  const r = await query("SELECT id, mess_name, mess_code, created_at FROM mess ORDER BY created_at DESC", []);
  return res.json({ messes: r.rows });
});

adminRouter.post("/messes", async (req, res) => {
  const { mess_name } = req.body || {};
  if (!mess_name) return res.status(400).json({ error: "mess_name required" });

  let mess_code = randomCode();
  for (let i = 0; i < 5; i++) {
    const r = await query(
      "INSERT INTO mess(mess_name, mess_code) VALUES ($1,$2) ON CONFLICT (mess_code) DO NOTHING RETURNING id, mess_name, mess_code, created_at",
      [String(mess_name), mess_code]
    );
    if (r.rows[0]) return res.json({ mess: r.rows[0] });
    mess_code = randomCode();
  }
  return res.status(500).json({ error: "Failed to generate mess_code" });
});

adminRouter.post("/messes/:messId/assign-admin", async (req, res) => {
  const { messId } = req.params;
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "name, email, password required" });

  const exists = await query("SELECT id FROM mess WHERE id=$1", [messId]);
  if (!exists.rows[0]) return res.status(404).json({ error: "Mess not found" });

  const hash = await bcrypt.hash(String(password), 10);
  try {
    const r = await query(
      "INSERT INTO users(name,email,password,role,mess_id) VALUES ($1,$2,$3,'mess_admin',$4) RETURNING id,name,email,role,mess_id,created_at",
      [String(name), String(email).toLowerCase(), hash, messId]
    );
    return res.json({ user: r.rows[0] });
  } catch (e) {
    if (String(e?.code) === "23505") return res.status(409).json({ error: "Email already exists" });
    throw e;
  }
});

adminRouter.get("/mess-requests", async (req, res) => {
  const status = String(req.query.status || "pending").trim();
  const allowed = new Set(["pending", "approved", "rejected"]);
  const st = allowed.has(status) ? status : "pending";

  const r = await query(
    `
    SELECT id, mess_name, requester_name, requester_email, message, status, created_at, decided_at, mess_id, admin_user_id
    FROM mess_requests
    WHERE status=$1
    ORDER BY created_at DESC
    `,
    [st]
  );
  return res.json({ requests: r.rows });
});

adminRouter.post("/mess-requests/:id/reject", async (req, res) => {
  const id = req.params.id;
  const r = await query(
    `
    UPDATE mess_requests
    SET status='rejected', decided_at=now(), decided_by=$2
    WHERE id=$1 AND status='pending'
    RETURNING id, status, decided_at
    `,
    [id, req.user.user_id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: "Request not found (or already decided)" });
  return res.json({ request: r.rows[0] });
});

adminRouter.post("/mess-requests/:id/approve", async (req, res) => {
  const id = req.params.id;
  const { admin_name, admin_email, admin_password } = req.body || {};

  const rr = await query(
    "SELECT id, mess_name, requester_name, requester_email, status FROM mess_requests WHERE id=$1",
    [id]
  );
  const reqRow = rr.rows[0];
  if (!reqRow || reqRow.status !== "pending") {
    return res.status(404).json({ error: "Request not found (or already decided)" });
  }

  const name = String(admin_name || reqRow.requester_name || "").trim();
  const email = String(admin_email || reqRow.requester_email || "").trim().toLowerCase();
  if (!name) return res.status(400).json({ error: "admin_name required" });
  if (!email) return res.status(400).json({ error: "admin_email required" });

  const plainPassword = String(admin_password || randomPassword());
  const hash = await bcrypt.hash(plainPassword, 10);

  let mess;
  let messCode = randomCode();

  await query("BEGIN", []);
  try {
    // Create mess (retry code conflicts).
    for (let i = 0; i < 6; i++) {
      const m = await query(
        "INSERT INTO mess(mess_name, mess_code) VALUES ($1,$2) ON CONFLICT (mess_code) DO NOTHING RETURNING id,mess_name,mess_code,created_at",
        [reqRow.mess_name, messCode]
      );
      if (m.rows[0]) {
        mess = m.rows[0];
        break;
      }
      messCode = randomCode();
    }
    if (!mess) throw new Error("Failed to generate unique mess_code");

    // Create mess admin user.
    const u = await query(
      "INSERT INTO users(name,email,password,role,mess_id) VALUES ($1,$2,$3,'mess_admin',$4) RETURNING id,name,email,role,mess_id,created_at",
      [name, email, hash, mess.id]
    );

    // Mark request approved.
    await query(
      `
      UPDATE mess_requests
      SET status='approved', decided_at=now(), decided_by=$2, mess_id=$3, admin_user_id=$4
      WHERE id=$1
      `,
      [id, req.user.user_id, mess.id, u.rows[0].id]
    );

    await query("COMMIT", []);
    return res.json({
      mess,
      admin: u.rows[0],
      credentials: {
        email,
        password: plainPassword,
        mess_code: mess.mess_code,
      },
    });
  } catch (e) {
    await query("ROLLBACK", []);
    if (String(e?.code) === "23505") {
      return res.status(409).json({ error: "Admin email already exists" });
    }
    return res.status(500).json({ error: String(e.message || e) });
  }
});
