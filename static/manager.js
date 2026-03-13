function byId(id) {
  return document.getElementById(id);
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmtMoney(n) {
  const num = Number(n || 0);
  if (Number.isNaN(num)) return "৳0";
  const fixed = num.toFixed(2);
  return `৳${fixed.replace(/\.00$/, "")}`;
}

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("is-on");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toast.classList.remove("is-on"), 2200);
}

async function apiGet(path) {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

async function apiPost(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

async function apiPut(path, payload) {
  const res = await fetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

async function apiDelete(path) {
  const res = await fetch(path, { method: "DELETE", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || `Request failed: ${res.status}`);
  return data;
}

let MEMBERS = [];

function fillSelect(sel) {
  sel.innerHTML = "";
  for (const m of MEMBERS) {
    const opt = document.createElement("option");
    opt.value = String(m.id);
    opt.textContent = m.name;
    sel.appendChild(opt);
  }
}

function renderMembers() {
  const body = byId("membersBody");
  body.innerHTML = "";
  for (const m of MEMBERS) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(m.id);
    tr.appendChild(tdId);

    const tdName = document.createElement("td");
    const input = document.createElement("input");
    input.value = m.name;
    input.className = "inline";
    tdName.appendChild(input);
    tr.appendChild(tdName);

    const tdActions = document.createElement("td");
    tdActions.className = "num";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn btn--ghost";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async () => {
      try {
        await apiPut(`/api/members/${m.id}`, { name: input.value });
        showToast("Member updated.");
        await loadAll();
      } catch (e) {
        showToast(e.message || "Failed.");
      }
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn btn--danger";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Delete member "${m.name}"? This also deletes their records.`)) return;
      try {
        await apiDelete(`/api/members/${m.id}`);
        showToast("Member deleted.");
        await loadAll();
      } catch (e) {
        showToast(e.message || "Failed.");
      }
    });

    tdActions.appendChild(saveBtn);
    tdActions.appendChild(delBtn);
    tr.appendChild(tdActions);

    body.appendChild(tr);
  }
}

function makeRowActions(onSave, onDelete) {
  const td = document.createElement("td");
  td.className = "num";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn--ghost";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", onSave);

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "btn btn--danger";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", onDelete);

  td.appendChild(saveBtn);
  td.appendChild(delBtn);
  return td;
}

async function loadMeals() {
  const data = await apiGet("/api/meals?limit=200");
  const body = byId("mealsBody");
  body.innerHTML = "";
  for (const r of data.meals || []) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(r.id);
    tr.appendChild(tdId);

    const tdDate = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "inline";
    dateInput.value = r.date;
    tdDate.appendChild(dateInput);
    tr.appendChild(tdDate);

    const tdMember = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "inline";
    for (const m of MEMBERS) {
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = m.name;
      if (m.id === r.member_id) opt.selected = true;
      sel.appendChild(opt);
    }
    tdMember.appendChild(sel);
    tr.appendChild(tdMember);

    const tdMeal = document.createElement("td");
    tdMeal.className = "num";
    const mealInput = document.createElement("input");
    mealInput.type = "number";
    mealInput.step = "0.5";
    mealInput.min = "0";
    mealInput.className = "inline numInput";
    mealInput.value = String(r.meal_count);
    tdMeal.appendChild(mealInput);
    tr.appendChild(tdMeal);

    const actions = makeRowActions(
      async () => {
        try {
          await apiPut(`/api/meals/${r.id}`, {
            date: dateInput.value,
            member_id: Number(sel.value),
            meal_count: Number(mealInput.value),
          });
          showToast("Meal updated.");
        } catch (e) {
          showToast(e.message || "Failed.");
        }
      },
      async () => {
        if (!confirm("Delete this meal entry?")) return;
        try {
          await apiDelete(`/api/meals/${r.id}`);
          showToast("Meal deleted.");
          await loadMeals();
        } catch (e) {
          showToast(e.message || "Failed.");
        }
      }
    );
    tr.appendChild(actions);

    body.appendChild(tr);
  }
}

async function loadBazar() {
  const data = await apiGet("/api/bazar?limit=200");
  const body = byId("bazarBody");
  body.innerHTML = "";
  for (const r of data.bazar || []) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(r.id);
    tr.appendChild(tdId);

    const tdDate = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "inline";
    dateInput.value = r.date;
    tdDate.appendChild(dateInput);
    tr.appendChild(tdDate);

    const tdMember = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "inline";
    for (const m of MEMBERS) {
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = m.name;
      if (m.id === r.member_id) opt.selected = true;
      sel.appendChild(opt);
    }
    tdMember.appendChild(sel);
    tr.appendChild(tdMember);

    const tdAmt = document.createElement("td");
    tdAmt.className = "num";
    const amtInput = document.createElement("input");
    amtInput.type = "number";
    amtInput.step = "0.01";
    amtInput.min = "0";
    amtInput.className = "inline numInput";
    amtInput.value = String(r.amount);
    tdAmt.appendChild(amtInput);
    tr.appendChild(tdAmt);

    const tdDesc = document.createElement("td");
    const descInput = document.createElement("input");
    descInput.type = "text";
    descInput.maxLength = 500;
    descInput.className = "inline";
    descInput.value = r.description || "";
    tdDesc.appendChild(descInput);
    tr.appendChild(tdDesc);

    const actions = makeRowActions(
      async () => {
        try {
          await apiPut(`/api/bazar/${r.id}`, {
            date: dateInput.value,
            member_id: Number(sel.value),
            amount: Number(amtInput.value),
            description: descInput.value,
          });
          showToast("Expense updated.");
        } catch (e) {
          showToast(e.message || "Failed.");
        }
      },
      async () => {
        if (!confirm("Delete this expense entry?")) return;
        try {
          await apiDelete(`/api/bazar/${r.id}`);
          showToast("Expense deleted.");
          await loadBazar();
        } catch (e) {
          showToast(e.message || "Failed.");
        }
      }
    );
    tr.appendChild(actions);

    body.appendChild(tr);
  }
}

async function loadDeposits() {
  const data = await apiGet("/api/deposits?limit=200");
  const body = byId("depositsBody");
  body.innerHTML = "";
  for (const r of data.deposits || []) {
    const tr = document.createElement("tr");

    const tdId = document.createElement("td");
    tdId.textContent = String(r.id);
    tr.appendChild(tdId);

    const tdDate = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "inline";
    dateInput.value = r.date;
    tdDate.appendChild(dateInput);
    tr.appendChild(tdDate);

    const tdMember = document.createElement("td");
    const sel = document.createElement("select");
    sel.className = "inline";
    for (const m of MEMBERS) {
      const opt = document.createElement("option");
      opt.value = String(m.id);
      opt.textContent = m.name;
      if (m.id === r.member_id) opt.selected = true;
      sel.appendChild(opt);
    }
    tdMember.appendChild(sel);
    tr.appendChild(tdMember);

    const tdAmt = document.createElement("td");
    tdAmt.className = "num";
    const amtInput = document.createElement("input");
    amtInput.type = "number";
    amtInput.step = "0.01";
    amtInput.min = "0";
    amtInput.className = "inline numInput";
    amtInput.value = String(r.amount);
    tdAmt.appendChild(amtInput);
    tr.appendChild(tdAmt);

    const actions = makeRowActions(
      async () => {
        try {
          await apiPut(`/api/deposits/${r.id}`, {
            date: dateInput.value,
            member_id: Number(sel.value),
            amount: Number(amtInput.value),
          });
          showToast("Deposit updated.");
        } catch (e) {
          showToast(e.message || "Failed.");
        }
      },
      async () => {
        if (!confirm("Delete this deposit entry?")) return;
        try {
          await apiDelete(`/api/deposits/${r.id}`);
          showToast("Deposit deleted.");
          await loadDeposits();
        } catch (e) {
          showToast(e.message || "Failed.");
        }
      }
    );
    tr.appendChild(actions);

    body.appendChild(tr);
  }
}

async function loadAll() {
  const m = await apiGet("/api/members");
  MEMBERS = m.members || [];
  renderMembers();
  fillSelect(byId("mealMemberSelect"));
  fillSelect(byId("bazarMemberSelect"));
  fillSelect(byId("depositMemberSelect"));
  await Promise.all([loadMeals(), loadBazar(), loadDeposits()]);
}

function wireCreateButtons() {
  byId("addMemberBtn").addEventListener("click", async () => {
    const name = (byId("newMemberName").value || "").trim();
    if (!name) return showToast("Member name required.");
    try {
      await apiPost("/api/members", { name });
      byId("newMemberName").value = "";
      showToast("Member added.");
      await loadAll();
    } catch (e) {
      showToast(e.message || "Failed.");
    }
  });

  byId("addMealBtn").addEventListener("click", async () => {
    try {
      await apiPost("/api/add_meal", {
        member_id: Number(byId("mealMemberSelect").value),
        date: byId("mealDateInput").value,
        meal_count: Number(byId("mealCountInput").value),
      });
      byId("mealCountInput").value = "";
      showToast("Meal added.");
      await loadMeals();
    } catch (e) {
      showToast(e.message || "Failed.");
    }
  });

  byId("addBazarBtn").addEventListener("click", async () => {
    try {
      await apiPost("/api/add_bazar", {
        member_id: Number(byId("bazarMemberSelect").value),
        date: byId("bazarDateInput").value,
        amount: Number(byId("bazarAmountInput").value),
        description: byId("bazarDescInput").value,
      });
      byId("bazarAmountInput").value = "";
      byId("bazarDescInput").value = "";
      showToast("Expense added.");
      await loadBazar();
    } catch (e) {
      showToast(e.message || "Failed.");
    }
  });

  byId("addDepositBtn").addEventListener("click", async () => {
    try {
      await apiPost("/api/add_deposit", {
        member_id: Number(byId("depositMemberSelect").value),
        date: byId("depositDateInput").value,
        amount: Number(byId("depositAmountInput").value),
      });
      byId("depositAmountInput").value = "";
      showToast("Deposit added.");
      await loadDeposits();
    } catch (e) {
      showToast(e.message || "Failed.");
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  byId("mealDateInput").value = todayISO();
  byId("bazarDateInput").value = todayISO();
  byId("depositDateInput").value = todayISO();
  wireCreateButtons();
  await loadAll();
});

