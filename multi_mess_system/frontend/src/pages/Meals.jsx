import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";

function monthNow() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function daysInMonth(monthStr) {
  const [y, m] = monthStr.split("-").map((x) => Number(x));
  return new Date(y, m, 0).getDate();
}

function isoForDay(monthStr, day) {
  const dd = String(day).padStart(2, "0");
  return `${monthStr}-${dd}`;
}

export default function Meals() {
  const [month, setMonth] = useState(monthNow());
  const [members, setMembers] = useState([]);
  const [entries, setEntries] = useState(new Map()); // key date|member -> value
  const [dirty, setDirty] = useState(new Set()); // keys changed
  const [msg, setMsg] = useState("");
  const savingRef = useRef(null);

  const totalDays = useMemo(() => daysInMonth(month), [month]);

  const key = (date, memberId) => `${date}|${memberId}`;

  const load = async () => {
    setMsg("");
    const data = await api.get(`/meals/matrix?month=${encodeURIComponent(month)}`);
    setMembers(data.members || []);
    const map = new Map();
    for (const e of data.entries || []) {
      map.set(key(e.date, e.member_id), String(e.meal_count));
    }
    setEntries(map);
    setDirty(new Set());
  };

  useEffect(() => {
    load().catch(() => {});
  }, [month]);

  const setCell = (date, memberId, value) => {
    const k = key(date, memberId);
    setEntries((prev) => {
      const next = new Map(prev);
      next.set(k, value);
      return next;
    });
    setDirty((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });

    // Autosave debounce
    if (savingRef.current) clearTimeout(savingRef.current);
    savingRef.current = setTimeout(() => {
      save().catch(() => {});
    }, 650);
  };

  const save = async () => {
    if (!dirty.size) return;
    const payload = [];
    for (const k of dirty) {
      const [date, memberId] = k.split("|");
      const raw = (entries.get(k) || "").trim();
      payload.push({
        date,
        member_id: memberId,
        meal_count: raw === "" ? null : Number(raw),
      });
    }
    await api.post("/meals/matrix", { month, entries: payload });
    setDirty(new Set());
    setMsg("Autosaved.");
    setTimeout(() => setMsg(""), 1200);
  };

  const totals = useMemo(() => {
    const t = new Map();
    for (const m of members) t.set(m.id, 0);
    for (let d = 1; d <= totalDays; d++) {
      const date = isoForDay(month, d);
      for (const m of members) {
        const v = Number(entries.get(key(date, m.id)) || 0);
        t.set(m.id, (t.get(m.id) || 0) + (Number.isFinite(v) ? v : 0));
      }
    }
    return t;
  }, [entries, members, month, totalDays]);

  return (
    <div>
      <div className="topRow">
        <h1 className="h1">Meal Entry</h1>
        <div className="row">
          <label className="field">
            <span>Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <button className="btn ghost" onClick={load}>
            Reload
          </button>
          <button className="btn primary" onClick={save} disabled={!dirty.size}>
            Save Now
          </button>
        </div>
      </div>

      {msg ? <div className="alert ok">{msg}</div> : null}

      <div className="card">
        <div className="tableWrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="stickyDate">Date</th>
                {members.map((m) => (
                  <th key={m.id}>{m.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                const date = isoForDay(month, day);
                return (
                  <tr key={date}>
                    <td className="stickyDate mono">{date}</td>
                    {members.map((m) => {
                      const v = entries.get(key(date, m.id)) || "";
                      return (
                        <td key={m.id}>
                          <input
                            className="cell"
                            type="number"
                            step="0.5"
                            min="0"
                            value={v}
                            onChange={(e) => setCell(date, m.id, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="stickyDate foot">Total</td>
                {members.map((m) => (
                  <td key={m.id} className="num foot">
                    {(totals.get(m.id) || 0).toFixed(2).replace(/\.00$/, "")}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="muted">Auto-saves on change. Decimals allowed (0.5, 1, 1.5, 2).</div>
      </div>
    </div>
  );
}

