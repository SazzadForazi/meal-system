import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";

function monthNow() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

export default function Reports() {
  const [month, setMonth] = useState(monthNow());
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const r = await api.get(`/reports/monthly?month=${encodeURIComponent(month)}`);
      setData(r);
    } catch (e) {
      setErr(e.message || "Failed");
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [month]);

  return (
    <div>
      <div className="topRow">
        <h1 className="h1">Monthly Report</h1>
        <label className="field">
          <span>Month</span>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {err ? <div className="alert bad">{err}</div> : null}
      {data ? (
        <div className="card">
          <div className="kpis">
            <div className="kpi">
              <div className="muted">Total Bazaar</div>
              <div className="kpiVal">৳{Number(data.total_bazaar).toFixed(2)}</div>
            </div>
            <div className="kpi">
              <div className="muted">Total Meals</div>
              <div className="kpiVal">{Number(data.total_meals).toFixed(2).replace(/\.00$/, "")}</div>
            </div>
            <div className="kpi">
              <div className="muted">Meal Rate</div>
              <div className="kpiVal">৳{Number(data.meal_rate).toFixed(2)}</div>
            </div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="num">Meals</th>
                  <th className="num">Cost</th>
                  <th className="num">Contribution</th>
                  <th className="num">Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.member_id}>
                    <td>{r.name}</td>
                    <td className="num mono">{Number(r.total_meals).toFixed(2).replace(/\.00$/, "")}</td>
                    <td className="num mono">৳{Number(r.cost).toFixed(2)}</td>
                    <td className="num mono">৳{Number(r.contribution).toFixed(2)}</td>
                    <td className="num mono">{Number(r.balance).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted">Balance = Contribution - (Meals × Meal Rate).</div>
        </div>
      ) : null}
    </div>
  );
}

