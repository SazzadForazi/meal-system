import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function SuperAdmin() {
  const [messes, setMesses] = useState([]);
  const [messName, setMessName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [requests, setRequests] = useState([]);
  const [cred, setCred] = useState(null);

  const load = async () => {
    const data = await api.get("/admin/messes");
    setMesses(data.messes || []);
    const r = await api.get("/admin/mess-requests?status=pending");
    setRequests(r.requests || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const createMess = async () => {
    setMsg("");
    setErr("");
    setCred(null);
    try {
      const data = await api.post("/admin/messes", { mess_name: messName });
      setMsg(`Created: ${data.mess.mess_name} (${data.mess.mess_code})`);
      setMessName("");
      await load();
    } catch (e) {
      setErr(e.message || "Failed");
    }
  };

  return (
    <div>
      <h1 className="h1">Messes</h1>

      <div className="card">
        <div className="muted">Pending mess requests</div>
        {cred ? (
          <div className="alert ok">
            Approved. Admin login created:
            <div className="mono">Email: {cred.email}</div>
            <div className="mono">Password: {cred.password}</div>
            <div className="mono">Mess Code: {cred.mess_code}</div>
            <div className="muted">Copy this and send to the mess admin (password shown only once).</div>
          </div>
        ) : null}
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Mess</th>
                <th>Requester</th>
                <th>Message</th>
                <th className="num">Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.mess_name}</td>
                  <td className="mono">
                    {r.requester_name} <br />
                    {r.requester_email}
                  </td>
                  <td>{r.message}</td>
                  <td className="num">
                    <button
                      className="btn primary"
                      onClick={async () => {
                        setErr("");
                        setMsg("");
                        setCred(null);
                        try {
                          const ok = confirm(`Approve "${r.mess_name}" and create admin for ${r.requester_email}?`);
                          if (!ok) return;
                          const out = await api.post(`/admin/mess-requests/${r.id}/approve`, {});
                          setCred(out.credentials);
                          await load();
                        } catch (e) {
                          setErr(e.message || "Failed");
                        }
                      }}
                    >
                      Approve
                    </button>{" "}
                    <button
                      className="btn danger"
                      onClick={async () => {
                        setErr("");
                        setMsg("");
                        setCred(null);
                        try {
                          const ok = confirm(`Reject request "${r.mess_name}"?`);
                          if (!ok) return;
                          await api.post(`/admin/mess-requests/${r.id}/reject`, {});
                          await load();
                        } catch (e) {
                          setErr(e.message || "Failed");
                        }
                      }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {!requests.length ? (
                <tr>
                  <td colSpan="4" className="muted">
                    No pending requests.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {err ? <div className="alert bad">{err}</div> : null}
      </div>

      <div className="card">
        <div className="row">
          <input value={messName} onChange={(e) => setMessName(e.target.value)} placeholder="New mess name" />
          <button className="btn primary" onClick={createMess} disabled={!messName.trim()}>
            Create
          </button>
        </div>
        {msg ? <div className="alert ok">{msg}</div> : null}
        {err ? <div className="alert bad">{err}</div> : null}
      </div>

      <div className="card">
        <div className="muted">All messes</div>
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {messes.map((m) => (
                <tr key={m.id}>
                  <td>{m.mess_name}</td>
                  <td className="mono">{m.mess_code}</td>
                  <td className="mono">{String(m.created_at).slice(0, 10)}</td>
                </tr>
              ))}
              {!messes.length ? (
                <tr>
                  <td colSpan="3" className="muted">
                    No messes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
