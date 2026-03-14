import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Bazaar() {
  const [list, setList] = useState([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [err, setErr] = useState("");

  const load = async () => {
    const data = await api.get("/bazaar");
    setList(data.bazaar || []);
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const add = async () => {
    setErr("");
    try {
      await api.post("/bazaar", { amount: Number(amount), description, date });
      setAmount("");
      setDescription("");
      await load();
    } catch (e) {
      setErr(e.message || "Failed");
    }
  };

  return (
    <div>
      <h1 className="h1">Bazaar</h1>

      <div className="card">
        <div className="row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Amount</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" />
          </label>
          <label className="field grow">
            <span>Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button className="btn primary" onClick={add} disabled={!amount || !date}>
            Add
          </button>
        </div>
        {err ? <div className="alert bad">{err}</div> : null}
      </div>

      <div className="card">
        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.date}</td>
                  <td>{b.description}</td>
                  <td className="num mono">{Number(b.amount).toFixed(2)}</td>
                </tr>
              ))}
              {!list.length ? (
                <tr>
                  <td colSpan="3" className="muted">
                    No entries.
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

