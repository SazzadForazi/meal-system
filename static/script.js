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
let IS_MANAGER = false;

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
    td.textContent = "No members found. Seed data by running `python3 init_db.py`.";
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

function setFormsEnabled(enabled) {
  const forms = [byId("bazarForm"), byId("depositForm")];
  for (const form of forms) {
    const controls = form.querySelectorAll("input, select, button, textarea");
    for (const el of controls) el.disabled = !enabled;
  }
  byId("authNote").hidden = enabled;
}

async function loadMembers() {
  const data = await apiGet("/api/members");
  MEMBERS = data.members || [];
  fillMemberSelect(byId("bazarMember"));
  fillMemberSelect(byId("depositMember"));
}

async function loadSummary() {
  const data = await apiGet("/api/summary");
  byId("totalMeals").textContent = fmtNumber(data.total_meals);
  byId("totalExpenses").textContent = fmtMoney(data.total_expenses);
  byId("mealRate").textContent = fmtMoney(data.meal_rate);
  byId("totalDeposits").textContent = fmtMoney(data.total_deposits);
}

async function loadMemberStats() {
  const tasks = MEMBERS.map((m) => apiGet(`/api/member_stats/${m.id}`));
  const rows = await Promise.all(tasks);
  rows.sort((a, b) => a.member.name.localeCompare(b.member.name));
  renderMemberRows(rows);
}

// Refreshes summary cards + member table in one go.
async function refreshAll() {
  try {
    await loadSummary();
    await loadMemberStats();
    await loadRecentActivity();
  } catch (e) {
    throw e;
  }
}

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

function displayDate(iso) {
  // YYYY-MM-DD -> DD-MM-YYYY (as requested)
  const [y, m, d] = String(iso).split("-");
  return `${d}-${m}-${y}`;
}

let MATRIX_MONTH = null;
let MATRIX_MEMBERS = [];
let MATRIX_BASELINE = new Map(); // key: date|memberId -> number

function matrixKey(dateIso, memberId) {
  return `${dateIso}|${memberId}`;
}

function buildMealMatrixTable(monthStr, members, entries) {
  MATRIX_MONTH = monthStr;
  MATRIX_MEMBERS = members.slice();
  MATRIX_BASELINE = new Map();
  for (const e of entries) {
    MATRIX_BASELINE.set(matrixKey(e.date, e.member_id), Number(e.meal_count));
  }

  const thead = byId("mealMatrixThead");
  const tbody = byId("mealMatrixTbody");
  thead.innerHTML = "";
  tbody.innerHTML = "";

  const trh = document.createElement("tr");
  const thDate = document.createElement("th");
  thDate.textContent = "Date";
  thDate.className = "dateCol";
  trh.appendChild(thDate);
  for (const m of members) {
    const th = document.createElement("th");
    th.textContent = m.name;
    trh.appendChild(th);
  }
  thead.appendChild(trh);

  const totalDays = daysInMonth(monthStr);
  for (let day = 1; day <= totalDays; day++) {
    const dateIso = isoForDay(monthStr, day);
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    tdDate.className = "dateCell";
    tdDate.textContent = displayDate(dateIso);
    tdDate.title = dateIso;
    tr.appendChild(tdDate);

    for (const m of members) {
      const td = document.createElement("td");
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "0.5";
      inp.className = "mealCell";
      inp.inputMode = "decimal";
      inp.autocomplete = "off";
      inp.disabled = !IS_MANAGER;
      inp.dataset.date = dateIso;
      inp.dataset.memberId = String(m.id);

      const v = MATRIX_BASELINE.get(matrixKey(dateIso, m.id));
      inp.value = v == null ? "" : String(v);

      td.appendChild(inp);
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  const hint = byId("mealMonthHint");
  hint.textContent = `Loaded ${members.length} member(s) for ${monthStr}.`;
}

async function loadMealMatrix(monthStr) {
  const data = await apiGet(`/api/meals_matrix?month=${encodeURIComponent(monthStr)}`);
  buildMealMatrixTable(data.month, data.members || [], data.entries || []);
}

async function saveMealMatrix() {
  if (!IS_MANAGER) {
    showToast("Manager login required.", "bad");
    return;
  }
  if (!MATRIX_MONTH) {
    showToast("Load a month first.", "bad");
    return;
  }

  const inputs = Array.from(byId("mealMatrixTbody").querySelectorAll("input.mealCell"));
  const changes = [];
  const eps = 0.000001;

  for (const inp of inputs) {
    const dateIso = inp.dataset.date;
    const memberId = Number(inp.dataset.memberId);
    const raw = String(inp.value || "").trim();
    const key = matrixKey(dateIso, memberId);
    const oldV = MATRIX_BASELINE.has(key) ? Number(MATRIX_BASELINE.get(key)) : null;

    if (raw === "") {
      if (oldV != null) {
        changes.push({ date: dateIso, member_id: memberId, meal_count: null });
      }
      continue;
    }

    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      throw new Error(`Invalid meal value at ${displayDate(dateIso)}.`);
    }

    // Treat 0 as blank (delete) to avoid storing clutter rows.
    if (num === 0) {
      if (oldV != null) changes.push({ date: dateIso, member_id: memberId, meal_count: null });
      continue;
    }

    if (oldV == null || Math.abs(num - oldV) > eps) {
      changes.push({ date: dateIso, member_id: memberId, meal_count: num });
    }
  }

  if (!changes.length) {
    showToast("No changes to save.", "info");
    return;
  }

  await apiPost("/api/meals_matrix", { month: MATRIX_MONTH, entries: changes });
  showToast("Saved month meals.", "ok");
  await loadMealMatrix(MATRIX_MONTH);
  await refreshAll();
}

function setActiveTab(active) {
  const tabs = [
    { key: "meals", tab: byId("tabMeals"), panel: byId("panelMeals") },
    { key: "bazar", tab: byId("tabBazar"), panel: byId("panelBazar") },
    { key: "deposits", tab: byId("tabDeposits"), panel: byId("panelDeposits") },
  ];
  for (const t of tabs) {
    const on = t.key === active;
    t.tab.classList.toggle("is-on", on);
    t.tab.setAttribute("aria-selected", on ? "true" : "false");
    t.panel.hidden = !on;
  }
}

function memberSelect(currentId) {
  const sel = document.createElement("select");
  sel.className = "inline";
  for (const m of MEMBERS) {
    const opt = document.createElement("option");
    opt.value = String(m.id);
    opt.textContent = m.name;
    if (m.id === currentId) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function actionButtons(onSave, onDelete) {
  const wrap = document.createElement("div");
  wrap.className = "actions";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "btn btn--ghost";
  save.textContent = "Save";
  save.disabled = !IS_MANAGER;
  save.addEventListener("click", onSave);

  const del = document.createElement("button");
  del.type = "button";
  del.className = "btn btn--danger";
  del.textContent = "Delete";
  del.disabled = !IS_MANAGER;
  del.addEventListener("click", onDelete);

  wrap.appendChild(save);
  wrap.appendChild(del);
  return wrap;
}

async function apiPut(path, payload) {
  const res = await fetch(path, {
    method: "PUT",
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

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data && data.error ? data.error : `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function loadRecentMeals() {
  const data = await apiGet("/api/meals?limit=30");
  const body = byId("recentMealsBody");
  body.innerHTML = "";

  const meals = data.meals || [];
  if (!meals.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="mutedCell">No meal entries yet.</td>`;
    body.appendChild(tr);
    return;
  }

  for (const r of meals) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(r.id);
    tr.appendChild(tdId);

    const tdDate = document.createElement("td");
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "date";
      inp.className = "inline";
      inp.value = r.date;
      tdDate.appendChild(inp);
      tdDate._inp = inp;
    } else {
      tdDate.textContent = r.date;
    }
    tr.appendChild(tdDate);

    const tdMember = document.createElement("td");
    if (IS_MANAGER) {
      const sel = memberSelect(r.member_id);
      tdMember.appendChild(sel);
      tdMember._sel = sel;
    } else {
      tdMember.textContent = r.member_name;
    }
    tr.appendChild(tdMember);

    const tdMeal = document.createElement("td");
    tdMeal.className = "num";
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "0.5";
      inp.className = "inline numInput";
      inp.value = String(r.meal_count);
      tdMeal.appendChild(inp);
      tdMeal._inp = inp;
    } else {
      tdMeal.textContent = fmtNumber(r.meal_count);
    }
    tr.appendChild(tdMeal);

    const tdActions = document.createElement("td");
    tdActions.className = "num";
    tdActions.appendChild(
      actionButtons(
        async () => {
          try {
            await apiPut(`/api/meals/${r.id}`, {
              date: IS_MANAGER ? tdDate._inp.value : r.date,
              member_id: IS_MANAGER ? Number(tdMember._sel.value) : r.member_id,
              meal_count: IS_MANAGER ? Number(tdMeal._inp.value) : Number(r.meal_count),
            });
            showToast("Meal updated.", "ok");
            await refreshAll();
          } catch (e) {
            showToast(e.message || "Failed.", "bad");
          }
        },
        async () => {
          if (!confirm("Delete this meal entry?")) return;
          try {
            await apiDelete(`/api/meals/${r.id}`);
            showToast("Meal deleted.", "ok");
            await refreshAll();
          } catch (e) {
            showToast(e.message || "Failed.", "bad");
          }
        }
      )
    );
    tr.appendChild(tdActions);

    body.appendChild(tr);
  }
}

async function loadRecentBazar() {
  const data = await apiGet("/api/bazar?limit=30");
  const body = byId("recentBazarBody");
  body.innerHTML = "";

  const items = data.bazar || [];
  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6" class="mutedCell">No expense entries yet.</td>`;
    body.appendChild(tr);
    return;
  }

  for (const r of items) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(r.id);
    tr.appendChild(tdId);

    const tdDate = document.createElement("td");
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "date";
      inp.className = "inline";
      inp.value = r.date;
      tdDate.appendChild(inp);
      tdDate._inp = inp;
    } else {
      tdDate.textContent = r.date;
    }
    tr.appendChild(tdDate);

    const tdMember = document.createElement("td");
    if (IS_MANAGER) {
      const sel = memberSelect(r.member_id);
      tdMember.appendChild(sel);
      tdMember._sel = sel;
    } else {
      tdMember.textContent = r.member_name;
    }
    tr.appendChild(tdMember);

    const tdAmt = document.createElement("td");
    tdAmt.className = "num";
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "0.01";
      inp.className = "inline numInput";
      inp.value = String(r.amount);
      tdAmt.appendChild(inp);
      tdAmt._inp = inp;
    } else {
      tdAmt.textContent = fmtMoney(r.amount);
    }
    tr.appendChild(tdAmt);

    const tdDesc = document.createElement("td");
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.maxLength = 500;
      inp.className = "inline";
      inp.value = r.description || "";
      tdDesc.appendChild(inp);
      tdDesc._inp = inp;
    } else {
      tdDesc.textContent = r.description || "";
    }
    tr.appendChild(tdDesc);

    const tdActions = document.createElement("td");
    tdActions.className = "num";
    tdActions.appendChild(
      actionButtons(
        async () => {
          try {
            await apiPut(`/api/bazar/${r.id}`, {
              date: IS_MANAGER ? tdDate._inp.value : r.date,
              member_id: IS_MANAGER ? Number(tdMember._sel.value) : r.member_id,
              amount: IS_MANAGER ? Number(tdAmt._inp.value) : Number(r.amount),
              description: IS_MANAGER ? tdDesc._inp.value : r.description,
            });
            showToast("Expense updated.", "ok");
            await refreshAll();
          } catch (e) {
            showToast(e.message || "Failed.", "bad");
          }
        },
        async () => {
          if (!confirm("Delete this expense entry?")) return;
          try {
            await apiDelete(`/api/bazar/${r.id}`);
            showToast("Expense deleted.", "ok");
            await refreshAll();
          } catch (e) {
            showToast(e.message || "Failed.", "bad");
          }
        }
      )
    );
    tr.appendChild(tdActions);

    body.appendChild(tr);
  }
}

async function loadRecentDeposits() {
  const data = await apiGet("/api/deposits?limit=30");
  const body = byId("recentDepositsBody");
  body.innerHTML = "";

  const items = data.deposits || [];
  if (!items.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="mutedCell">No deposit entries yet.</td>`;
    body.appendChild(tr);
    return;
  }

  for (const r of items) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(r.id);
    tr.appendChild(tdId);

    const tdDate = document.createElement("td");
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "date";
      inp.className = "inline";
      inp.value = r.date;
      tdDate.appendChild(inp);
      tdDate._inp = inp;
    } else {
      tdDate.textContent = r.date;
    }
    tr.appendChild(tdDate);

    const tdMember = document.createElement("td");
    if (IS_MANAGER) {
      const sel = memberSelect(r.member_id);
      tdMember.appendChild(sel);
      tdMember._sel = sel;
    } else {
      tdMember.textContent = r.member_name;
    }
    tr.appendChild(tdMember);

    const tdAmt = document.createElement("td");
    tdAmt.className = "num";
    if (IS_MANAGER) {
      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.step = "0.01";
      inp.className = "inline numInput";
      inp.value = String(r.amount);
      tdAmt.appendChild(inp);
      tdAmt._inp = inp;
    } else {
      tdAmt.textContent = fmtMoney(r.amount);
    }
    tr.appendChild(tdAmt);

    const tdActions = document.createElement("td");
    tdActions.className = "num";
    tdActions.appendChild(
      actionButtons(
        async () => {
          try {
            await apiPut(`/api/deposits/${r.id}`, {
              date: IS_MANAGER ? tdDate._inp.value : r.date,
              member_id: IS_MANAGER ? Number(tdMember._sel.value) : r.member_id,
              amount: IS_MANAGER ? Number(tdAmt._inp.value) : Number(r.amount),
            });
            showToast("Deposit updated.", "ok");
            await refreshAll();
          } catch (e) {
            showToast(e.message || "Failed.", "bad");
          }
        },
        async () => {
          if (!confirm("Delete this deposit entry?")) return;
          try {
            await apiDelete(`/api/deposits/${r.id}`);
            showToast("Deposit deleted.", "ok");
            await refreshAll();
          } catch (e) {
            showToast(e.message || "Failed.", "bad");
          }
        }
      )
    );
    tr.appendChild(tdActions);

    body.appendChild(tr);
  }
}

async function loadRecentActivity() {
  await Promise.all([loadRecentMeals(), loadRecentBazar(), loadRecentDeposits()]);
}

function wireForms() {
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
  byId("bazarDate").value = t;
  byId("depositDate").value = t;
}

document.addEventListener("DOMContentLoaded", async () => {
  setDefaultDates();
  wireForms();
  byId("tabMeals").addEventListener("click", () => setActiveTab("meals"));
  byId("tabBazar").addEventListener("click", () => setActiveTab("bazar"));
  byId("tabDeposits").addEventListener("click", () => setActiveTab("deposits"));
  setActiveTab("meals");
  try {
    const s = await apiGet("/api/session");
    if (s.logged_in) {
      IS_MANAGER = true;
      setDbStatus(`Manager: ${s.username}`, "ok");
      setFormsEnabled(true);
      byId("managerLink").textContent = "Manager Portal";
      byId("managerLink").href = "/manager";
      byId("logoutForm").hidden = false;
    } else {
      setDbStatus("Viewer mode", "neutral");
      setFormsEnabled(false);
      byId("managerLink").textContent = "Manager Login";
      byId("managerLink").href = "/login";
      byId("logoutForm").hidden = true;
    }
    await loadMembers();

    const monthInput = byId("mealMonth");
    monthInput.value = monthNow();
    byId("mealMonthLoad").addEventListener("click", async () => {
      try {
        await loadMealMatrix(monthInput.value);
      } catch (e) {
        showToast(e.message || "Failed to load month.", "bad");
      }
    });
    byId("mealMonthSave").addEventListener("click", async () => {
      try {
        await saveMealMatrix();
      } catch (e) {
        showToast(e.message || "Failed to save.", "bad");
      }
    });

    byId("mealMonthSave").disabled = !IS_MANAGER;
    await loadMealMatrix(monthInput.value);

    await refreshAll();
  } catch (e) {
    setDbStatus("DB missing?", "bad");
    showToast(
      (e && e.message ? e.message : "Failed to load data.") +
        " Run `python3 init_db.py` then restart the server.",
      "bad"
    );
  }
});
