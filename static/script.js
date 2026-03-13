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

function makeMemberSelect(selectedId) {
  const sel = document.createElement("select");
  for (const m of MEMBERS) {
    const opt = document.createElement("option");
    opt.value = String(m.id);
    opt.textContent = m.name;
    if (selectedId != null && Number(selectedId) === Number(m.id)) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function normalizeName(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findMemberIdByName(name) {
  const n = normalizeName(name);
  if (!n) return null;
  const exact = MEMBERS.find((m) => normalizeName(m.name) === n);
  if (exact) return exact.id;
  return null;
}

function refreshMealRowNumbers() {
  const body = byId("mealSheetBody");
  const rows = Array.from(body.children);
  rows.forEach((tr, idx) => {
    if (tr._rowNumEl) tr._rowNumEl.textContent = String(idx + 1);
  });
}

function addMealSheetRow({ memberId, dateValue, mealValue, focus = true, refresh = true } = {}) {
  const body = byId("mealSheetBody");
  const tr = document.createElement("tr");

  const tdNum = document.createElement("td");
  tdNum.className = "num";
  tdNum.dataset.label = "#";
  const numSpan = document.createElement("span");
  numSpan.className = "rowNum";
  tdNum.appendChild(numSpan);
  tr._rowNumEl = numSpan;
  tr.appendChild(tdNum);

  const tdMember = document.createElement("td");
  tdMember.dataset.label = "Member";
  const sel = makeMemberSelect(memberId ?? (MEMBERS[0] ? MEMBERS[0].id : null));
  tdMember.appendChild(sel);
  tr.appendChild(tdMember);

  const tdDate = document.createElement("td");
  tdDate.dataset.label = "Date";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = dateValue || todayISO();
  tdDate.appendChild(dateInput);
  tr.appendChild(tdDate);

  const tdMeal = document.createElement("td");
  tdMeal.className = "num";
  tdMeal.dataset.label = "Meal";
  const mealInput = document.createElement("input");
  mealInput.type = "number";
  mealInput.step = "0.5";
  mealInput.min = "0";
  mealInput.placeholder = "e.g., 2.5";
  mealInput.value = mealValue ?? "";
  mealInput.className = "numInput";
  tdMeal.appendChild(mealInput);
  tr.appendChild(tdMeal);

  const tdRow = document.createElement("td");
  tdRow.className = "num";
  tdRow.dataset.label = "Action";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn--danger btn--tiny";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", () => {
    tr.remove();
    if (!body.children.length) addMealSheetRow();
    refreshMealRowNumbers();
  });
  tdRow.appendChild(removeBtn);
  tr.appendChild(tdRow);

  // Store references for collection later.
  tr._memberSelect = sel;
  tr._dateInput = dateInput;
  tr._mealInput = mealInput;

  body.appendChild(tr);
  if (refresh) refreshMealRowNumbers();
  if (focus) mealInput.focus();
}

function addMealSheetBatch(dateValue) {
  const body = byId("mealSheetBody");

  if (!MEMBERS.length) {
    addMealSheetRow({ dateValue, focus: true, refresh: true });
    return;
  }

  for (const m of MEMBERS) {
    addMealSheetRow({
      memberId: m.id,
      dateValue,
      focus: false,
      refresh: false,
    });
  }
  refreshMealRowNumbers();

  // Focus first newly created meal cell for fast data entry.
  const lastN = MEMBERS.length;
  const rows = Array.from(body.children);
  const firstNew = rows[Math.max(0, rows.length - lastN)];
  if (firstNew && firstNew._mealInput) firstNew._mealInput.focus();
}

function initMealSheet() {
  const body = byId("mealSheetBody");
  body.innerHTML = "";
  addMealSheetBatch(todayISO());
  byId("mealAddRowBtn").addEventListener("click", () => {
    // Reuse the last row's date for faster entry.
    const last = body.lastElementChild;
    const lastDate = last && last._dateInput ? last._dateInput.value : todayISO();
    addMealSheetBatch(lastDate);
  });
}

function ensureMealRows(count) {
  const body = byId("mealSheetBody");
  while (body.children.length < count) addMealSheetRow();
}

function isIsoDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function wireMealSheetBehaviors() {
  const body = byId("mealSheetBody");

  // Enter on the meal cell adds a new row (sheet-like).
  body.addEventListener("keydown", (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.tagName !== "INPUT") return;
    if (target.getAttribute("type") !== "number") return;

    if (ev.key === "Enter") {
      ev.preventDefault();
      const tr = target.closest("tr");
      const rows = Array.from(body.children);
      const idx = rows.indexOf(tr);
      const lastDate = tr && tr._dateInput ? tr._dateInput.value : todayISO();

      if (idx === rows.length - 1) {
        addMealSheetRow({ dateValue: lastDate });
      } else {
        const next = rows[idx + 1];
        if (next && next._mealInput) next._mealInput.focus();
      }
    }

    if (ev.key === "ArrowDown") {
      const tr = target.closest("tr");
      const rows = Array.from(body.children);
      const idx = rows.indexOf(tr);
      const next = rows[idx + 1];
      if (next && next._mealInput) {
        ev.preventDefault();
        next._mealInput.focus();
      }
    }

    if (ev.key === "ArrowUp") {
      const tr = target.closest("tr");
      const rows = Array.from(body.children);
      const idx = rows.indexOf(tr);
      const prev = rows[idx - 1];
      if (prev && prev._mealInput) {
        ev.preventDefault();
        prev._mealInput.focus();
      }
    }
  });

  // Paste multi-line: one meal per line OR tab-separated rows: Member<TAB>Date<TAB>Meal.
  body.addEventListener("paste", (ev) => {
    const target = ev.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== "number") return;

    const text = (ev.clipboardData && ev.clipboardData.getData("text")) || "";
    const lines = text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) return;
    ev.preventDefault();

    const startTr = target.closest("tr");
    const rows = Array.from(body.children);
    const startIdx = rows.indexOf(startTr);
    const need = startIdx + lines.length;
    ensureMealRows(need);

    const rows2 = Array.from(body.children);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const tr = rows2[startIdx + i];
      if (!tr) continue;

      const parts = line.split("\t");
      if (parts.length >= 3) {
        const memberName = parts[0];
        const d = parts[1];
        const meal = parts[2];

        const memberId = findMemberIdByName(memberName);
        if (memberId != null) tr._memberSelect.value = String(memberId);
        if (isIsoDate(d)) tr._dateInput.value = d.trim();
        tr._mealInput.value = String(meal).trim();
      } else {
        tr._mealInput.value = line;
      }
    }

    const last = rows2[Math.min(startIdx + lines.length - 1, rows2.length - 1)];
    if (last && last._mealInput) last._mealInput.focus();
  });
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
  const forms = [byId("mealForm"), byId("bazarForm"), byId("depositForm")];
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
  byId("mealForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try {
      const rows = Array.from(byId("mealSheetBody").children);
      const payloads = [];
      for (const tr of rows) {
        const memberId = Number(tr._memberSelect.value);
        const dateValue = tr._dateInput.value;
        const mealValueRaw = tr._mealInput.value;
        if (String(mealValueRaw).trim() === "") continue; // allow empty rows
        const mealCount = Number(mealValueRaw);
        if (!Number.isFinite(mealCount) || mealCount < 0) {
          throw new Error("Meal count must be a number >= 0.");
        }
        payloads.push({ member_id: memberId, date: dateValue, meal_count: mealCount });
      }

      if (!payloads.length) {
        throw new Error("Add at least one meal value before submitting.");
      }

      // Post all rows (fast), then refresh once.
      await Promise.all(payloads.map((p) => apiPost("/api/add_meal", p)));

      // Clear meal inputs after successful submission.
      for (const tr of rows) tr._mealInput.value = "";
      showToast("Meals added successfully.", "ok");
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
    initMealSheet();
    wireMealSheetBehaviors();
    setFormsEnabled(IS_MANAGER);
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
