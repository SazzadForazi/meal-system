import React, { useState } from "react";
import { api } from "../lib/api.js";

export default function RequestMess() {
  const [messName, setMessName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setOk("");
    setErr("");
    try {
      await api.post("/public/mess-requests", {
        mess_name: messName,
        requester_name: name,
        requester_email: email,
        message,
      });
      setOk("Request submitted. Wait for Super Admin approval.");
      setMessName("");
      setName("");
      setEmail("");
      setMessage("");
    } catch (ex) {
      setErr(ex.message || "Failed");
    }
  };

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authTitle">Request a New Mess</div>
        <div className="muted">Send a message to the Super Admin to create your mess portal.</div>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Mess Name</span>
            <input value={messName} onChange={(e) => setMessName(e.target.value)} required />
          </label>
          <label className="field">
            <span>Your Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span>Your Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label className="field">
            <span>Message</span>
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional" />
          </label>

          {ok ? <div className="alert ok">{ok}</div> : null}
          {err ? <div className="alert bad">{err}</div> : null}

          <button className="btn primary" type="submit">
            Send Request
          </button>
          <a className="btn ghost" href="/auth/login">
            Back to Login
          </a>
        </form>
      </div>
    </div>
  );
}

