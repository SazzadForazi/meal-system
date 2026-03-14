import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../db.js";
import { config } from "../config.js";
import { authRequired } from "../middleware/auth.js";

export const authRouter = express.Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const r = await query("SELECT id, name, email, password, role, mess_id FROM users WHERE email=$1", [
    String(email).toLowerCase(),
  ]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(String(password), user.password);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    {
      user_id: user.id,
      role: user.role,
      mess_id: user.mess_id,
      email: user.email,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, mess_id: user.mess_id },
  });
});

authRouter.get("/me", authRequired, async (req, res) => {
  return res.json({ user: req.user });
});

