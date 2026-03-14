import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Members() {
  const [members, setMembers] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const data = await api.get("/members");
    setMembers(data.members || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const add = async () => {
    setError("");
    try {
      await api.post("/members", { name });
      setName("");
      await load();
    } catch (e) {
      setError(e.message || "Failed");
    }
  };

  const toggle = async (m) => {
    const next = m.status === "active" ? "inactive" : "active";
    await api.put(`/members/${m.id}`, { status: next });
    await load();
  };

  return (
    <div>
      <h1 className="h1">Members</h1>

      <div className="card">
        <div className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Member name" />
          <button className="btn primary" onClick={add} disabled={!name.trim()}>
            Add
          </button>
        </div>
        {error ? <div className="alert bad">{error}</div> : null}
      </div>

      <div className="card">
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th className="num">Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="mono">{m.status}</td>
                  <td className="num">
                    <button className="btn ghost" onClick={() => toggle(m)}>
                      {m.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {!members.length ? (
                <tr>
                  <td colSpan="3" className="muted">
                    No members.
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

