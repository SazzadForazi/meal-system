import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";

import { config } from "./config.js";
import { query } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { membersRouter } from "./routes/members.js";
import { mealsRouter } from "./routes/meals.js";
import { bazaarRouter } from "./routes/bazaar.js";
import { reportsRouter } from "./routes/reports.js";

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/public", publicRouter);
app.use("/auth", authRouter);
app.use("/admin", adminRouter);
app.use("/members", membersRouter);
app.use("/meals", mealsRouter);
app.use("/bazaar", bazaarRouter);
app.use("/reports", reportsRouter);

app.use((err, _req, res, _next) => {
  // Avoid leaking stack traces to clients; log server-side.
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

async function ensureSuperAdmin() {
  const email = config.superAdminEmail;
  const existing = await query("SELECT id, password, role FROM users WHERE email=$1", [email]);
  const hash = await bcrypt.hash(String(config.superAdminPassword), 10);

  if (!existing.rows[0]) {
    await query(
      "INSERT INTO users(name,email,password,role,mess_id) VALUES ($1,$2,$3,'super_admin',NULL)",
      [config.superAdminName, email, hash]
    );
    console.log(`Seeded super admin: ${email}`);
    return;
  }

  // Keep Super Admin aligned with env configuration. This makes it easy to change the
  // default credentials via compose env vars without manual SQL.
  const row = existing.rows[0];
  const needsRole = row.role !== "super_admin";
  if (needsRole) {
    await query("UPDATE users SET role='super_admin' WHERE id=$1", [row.id]);
  }

  await query("UPDATE users SET name=$1, password=$2 WHERE id=$3", [
    config.superAdminName,
    hash,
    row.id,
  ]);
}
}

ensureSuperAdmin()
  .then(() => {
    app.listen(config.port, () => {
      console.log(`API listening on http://localhost:${config.port}`);
    });
  })
  .catch((e) => {
    console.error("Startup failed:", e);
    process.exit(1);
  });
