import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/auth.js";

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("last_email") || "");
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(
    () => (localStorage.getItem("remember_password") || "0") === "1"
  );
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Ensure password never persists between reloads, even if the browser tries to restore it.
  useEffect(() => {
    setPassword("");
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      localStorage.setItem("last_email", String(email || ""));
      localStorage.setItem("remember_password", rememberPassword ? "1" : "0");
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authTitle">Sign in</div>
        <div className="muted">Use your email and password</div>

        <form className="form" onSubmit={onSubmit} autoComplete={rememberPassword ? "on" : "off"}>
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={rememberPassword ? "current-password" : "new-password"}
              required
            />
          </label>
          <label className="muted" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            Remember password on this device (browser password manager)
          </label>
          {error ? <div className="alert bad">{error}</div> : null}
          <button className="btn primary" type="submit">
            Login
          </button>
          <a className="btn ghost" href="/request-mess">
            Request New Mess
          </a>
        </form>
      </div>
    </div>
  );
}
