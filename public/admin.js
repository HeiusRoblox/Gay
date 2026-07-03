const API = "/api";
let token = localStorage.getItem("admin_token") || "";

const $ = (id) => document.getElementById(id);

// ── Auth ──────────────────────────────────────────────────────────────────────

async function apiRequest(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

$("login-btn").addEventListener("click", async () => {
  const password = $("password-input").value.trim();
  if (!password) return;
  $("login-error").classList.add("hidden");
  const data = await fetch(API + "/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }).then((r) => r.json());

  if (data.success) {
    token = data.token;
    localStorage.setItem("admin_token", token);
    showAdmin();
  } else {
    $("login-error").textContent = data.message || "Invalid password";
    $("login-error").classList.remove("hidden");
  }
});

$("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("login-btn").click();
});

$("logout-btn").addEventListener("click", async () => {
  await apiRequest("POST", "/admin/logout");
  token = "";
  localStorage.removeItem("admin_token");
  showLogin();
});

function showLogin() {
  $("admin-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  $("password-input").value = "";
}

async function showAdmin() {
  $("login-screen").classList.add("hidden");
  $("admin-screen").classList.remove("hidden");
  await loadKeys();
}

// ── Keys ──────────────────────────────────────────────────────────────────────

async function loadKeys() {
  const data = await apiRequest("GET", "/admin/keys");
  if (!data.success) { showLogin(); return; }
  renderKeys(data.keys);
}

function renderKeys(keys) {
  const tbody = $("keys-body");
  if (!keys.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">No keys found.</td></tr>`;
    return;
  }
  tbody.innerHTML = keys.map((k) => {
    const daysCls = k.daysLeft > 30 ? "days-ok" : k.daysLeft > 0 ? "days-warn" : "days-expired";
    const daysLabel = k.daysLeft <= 0 ? "Expired" : `${k.daysLeft}d`;
    const devCls = k.deviceCount >= k.maxDevices ? "days-warn" : "days-ok";
    const deviceLabel = `<span class="days-badge ${devCls}" style="cursor:pointer" title="${k.deviceIds.join('\n') || 'No devices'}">${k.deviceCount}/${k.maxDevices}</span>`;
    return `<tr>
      <td><span class="key-badge">${k.key}</span></td>
      <td>${k.expire}</td>
      <td><span class="days-badge ${daysCls}">${daysLabel}</span></td>
      <td>${deviceLabel}</td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-primary" onclick="openEdit('${k.key}', '${k.expire}', ${k.maxDevices}, ${k.deviceCount > 0})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDelete('${k.key}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function showAlert(msg, type = "success") {
  const el = $("alert");
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// ── Modal helpers ──────────────────────────────────────────────────────────────

function openModal(title, bodyHTML, onConfirm) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHTML;
  $("modal-overlay").classList.remove("hidden");
  const btn = $("modal-confirm");
  const handler = async () => {
    await onConfirm();
    closeModal();
    btn.removeEventListener("click", handler);
  };
  btn.addEventListener("click", handler);
}

function closeModal() {
  $("modal-overlay").classList.add("hidden");
  $("modal-body").innerHTML = "";
}

$("modal-close").addEventListener("click", closeModal);
$("modal-cancel").addEventListener("click", closeModal);
$("modal-overlay").addEventListener("click", (e) => {
  if (e.target === $("modal-overlay")) closeModal();
});

// ── Add Key ───────────────────────────────────────────────────────────────────

$("add-key-btn").addEventListener("click", () => {
  const defaultExpire = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  openModal("New Key", `
    <div class="field">
      <label>API Key</label>
      <input type="text" id="new-key" placeholder="e.g. MYKEY001" />
    </div>
    <div class="field">
      <label>Expiration Date</label>
      <input type="date" id="new-expire" value="${defaultExpire}" />
    </div>
    <div class="field">
      <label>Max Devices</label>
      <input type="number" id="new-max-devices" value="1" min="1" max="100" />
    </div>
  `, async () => {
    const key = $("new-key").value.trim();
    const expire = $("new-expire").value;
    const maxDevices = parseInt($("new-max-devices").value) || 1;
    if (!key || !expire) return;
    const data = await apiRequest("POST", "/admin/keys", { key, expire, maxDevices });
    if (data.success) {
      showAlert("Key created successfully.");
      loadKeys();
    } else {
      showAlert(data.message || "Failed to create key.", "error");
    }
  });
});

// ── Edit Key ──────────────────────────────────────────────────────────────────

function openEdit(key, currentExpire, currentMaxDevices, hasDevices) {
  openModal(`Edit: ${key}`, `
    <div class="field">
      <label>Key Name</label>
      <input type="text" id="edit-key" value="${key}" />
    </div>
    <div class="field">
      <label>Expiration Date</label>
      <input type="date" id="edit-expire" value="${currentExpire}" />
    </div>
    <div class="field">
      <label>Max Devices</label>
      <input type="number" id="edit-max-devices" value="${currentMaxDevices}" min="1" max="100" />
    </div>
    ${hasDevices ? `
    <div class="field" style="display:flex;align-items:center;gap:10px;margin-top:4px">
      <input type="checkbox" id="edit-reset-devices" style="width:auto;accent-color:#4f72e3" />
      <label for="edit-reset-devices" style="margin:0;cursor:pointer">Reset All Devices</label>
    </div>` : ""}
  `, async () => {
    const newKey = $("edit-key").value.trim();
    const expire = $("edit-expire").value;
    const maxDevices = parseInt($("edit-max-devices").value) || 1;
    const resetDevices = hasDevices ? $("edit-reset-devices").checked : false;
    if (!newKey || !expire) return;
    const body = {
      newKey: newKey !== key ? newKey : undefined,
      expire,
      maxDevices,
      resetDevices,
    };
    const data = await apiRequest("PUT", `/admin/keys/${key}`, body);
    if (data.success) {
      showAlert("Key updated.");
      loadKeys();
    } else {
      showAlert(data.message || "Failed to update.", "error");
    }
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

function confirmDelete(key) {
  openModal("Delete Key", `
    <p style="color:#a0aec0;line-height:1.6">
      Are you sure you want to delete key <strong style="color:#fc8181">${key}</strong>?<br/>
      This action cannot be undone.
    </p>
  `, async () => {
    const data = await apiRequest("DELETE", `/admin/keys/${key}`);
    if (data.success) {
      showAlert(`Key ${key} deleted.`);
      loadKeys();
    } else {
      showAlert(data.message || "Failed to delete.", "error");
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

if (token) {
  showAdmin();
} else {
  showLogin();
}
