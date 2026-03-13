function byId(id) {
  return document.getElementById(id);
}

function fmtNumber(n) {
  const num = Number(n || 0);
  if (Number.isNaN(num)) return "0";
  return num.toFixed(2).replace(/\.00$/, "");
}

function fmtMoney(n) {
  const num = Number(n || 0);
  if (Number.isNaN(num)) return "৳0";
  const fixed = num.toFixed(2);
  return `৳${fixed.replace(/\.00$/, "")}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

let MEMBERS = [];

function showToast(message, tone = "info") {
  const toast = byId("toast");
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("is-on");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.remove("is-on"), 2400);
}

async function apiGet(path) {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function apiPost(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function fillMemberSelect(selectEl) {
  selectEl.innerHTML = "";
  for (const m of MEMBERS) {
    const opt = document.createElement("option");
    opt.value = String(m.id);
    opt.textContent = m.name;
    selectEl.appendChild(opt);
  }
}

function setDbStatus(text, kind = "neutral") {
  const el = byId("dbStatus");
  el.textContent = text;
  el.dataset.kind = kind;
}

function renderMemberRows(rows) {
  const tbody = byId("memberTbody");
  tbody.innerHTML = "";

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "subtle";
    td.textContent = "No members found. Seed data by running `python init_db.py`.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const r of rows) {
    const tr = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = r.member.name;
    tr.appendChild(name);

    const meals = document.createElement("td");
    meals.className = "num";
    meals.textContent = fmtNumber(r.total_meals);
    tr.appendChild(meals);

    const dep = document.createElement("td");
    dep.className = "num";
    dep.textContent = fmtMoney(r.total_deposit);
    tr.appendChild(dep);

    const cost = document.createElement("td");
    cost.className = "num";
    cost.textContent = fmtMoney(r.total_cost);
    tr.appendChild(cost);

    const bal = document.createElement("td");
    bal.className = "num";
    const badge = document.createElement("span");
    badge.className = "badge";
    const v = Number(r.balance || 0);
    const abs = Math.abs(v);
    if (v >= 0.005) {
      badge.classList.add("badge--good");
      badge.textContent = `${fmtMoney(abs)} Advance`;
    } else if (v <= -0.005) {
      badge.classList.add("badge--bad");
      badge.textContent = `${fmtMoney(abs)} Due`;
    } else {
      badge.textContent = "৳0 Settled";
    }
    bal.appendChild(badge);
    tr.appendChild(bal);

    tbody.appendChild(tr);
  }
}

async function loadMembers() {
  const data = await apiGet("/api/members");
  MEMBERS = data.members || [];
  fillMemberSelect(byId("mealMember"));
  fillMemberSelect(byId("bazarMember"));
  fillMemberSelect(byId("depositMember"));
}

async function loadSummary() {
  const data = await apiGet("/api/summary");
  byId("totalMeals").textContent = fmtNumber(data.total_meals);
  byId("totalExpenses").textContent = fmtMoney(data.total_expenses);
  byId("mealRate").textContent = fmtMoney(data.meal_rate);
}

async function loadMemberStats() {
  const tasks = MEMBERS.map((m) => apiGet(`/api/member_stats/${m.id}`));
  const rows = await Promise.all(tasks);
  rows.sort((a, b) => a.member.name.localeCompare(b.member.name));
  renderMemberRows(rows);
}

// Refreshes summary cards + member table in one go.
async function refreshAll() {
  setDbStatus("Refreshing…", "neutral");
  try {
    await loadSummary();
    await loadMemberStats();
    setDbStatus("Live", "ok");
  } catch (e) {
    setDbStatus("Error", "bad");
    throw e;
  }
}

function wireForms() {
  byId("mealForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await apiPost("/api/add_meal", {
        member_id: Number(byId("mealMember").value),
        date: byId("mealDate").value,
        meal_count: Number(byId("mealCount").value),
      });
      byId("mealCount").value = "";
      showToast("Meal added successfully.", "ok");
      await refreshAll();
    } catch (e) {
      showToast(e.message || "Failed to add meal.", "bad");
    }
  });

  byId("bazarForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await apiPost("/api/add_bazar", {
        member_id: Number(byId("bazarMember").value),
        date: byId("bazarDate").value,
        amount: Number(byId("bazarAmount").value),
        description: byId("bazarDesc").value,
      });
      byId("bazarAmount").value = "";
      byId("bazarDesc").value = "";
      showToast("Expense added successfully.", "ok");
      await refreshAll();
    } catch (e) {
      showToast(e.message || "Failed to add expense.", "bad");
    }
  });

  byId("depositForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      await apiPost("/api/add_deposit", {
        member_id: Number(byId("depositMember").value),
        date: byId("depositDate").value,
        amount: Number(byId("depositAmount").value),
      });
      byId("depositAmount").value = "";
      showToast("Deposit added successfully.", "ok");
      await refreshAll();
    } catch (e) {
      showToast(e.message || "Failed to add deposit.", "bad");
    }
  });
}

function setDefaultDates() {
  const t = todayISO();
  byId("mealDate").value = t;
  byId("bazarDate").value = t;
  byId("depositDate").value = t;
}

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDates();
  wireForms();
  try {
    await loadMembers();
    await refreshAll();
  } catch (e) {
    setDbStatus("DB missing?", "bad");
    showToast(
      (e && e.message ? e.message : "Failed to load data.") +
        " Run `python init_db.py` then restart the server.",
      "bad"
    );
  }
});
