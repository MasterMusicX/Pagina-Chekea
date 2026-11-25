/**
 * ============================================================================
 * CKEKEA — LÓGICA DEL PANEL SUPERADMIN (admin.html)
 * ============================================================================
 * - Gráficas SVG de consumo de API y Chatbot por empresa + tendencia 7 días
 * - Creación de otros Superusuarios y usuarios comunes
 * - Control maestro de roles, planes, suspensión, bots y rotación de API Keys
 * - Configuración global de API Bancaria (Mercantil, BDV, Banesco, BNC, etc.)
 * - Cambio de contraseña Superadmin y auditoría del sistema
 */

(function () {
  "use strict";

  const AUTH_TOKEN_KEY = "ckekea_auth_jwt_v1";
  const AUTH_USER_KEY = "ckekea_auth_user_v1";

  if ((document.body.getAttribute("data-page") || "").toLowerCase() !== "admin") return;

  function getApiOrigin() {
    const cfg = window.CHEKEA_CONFIG && window.CHEKEA_CONFIG.platform;
    const savedOverride = localStorage.getItem("ckekea_platform_api_url");
    if (savedOverride) return savedOverride;
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return window.location.origin;
      }
      if (!window.location.hostname.endsWith("github.io")) {
        return window.location.origin;
      }
    }
    return (cfg && cfg.apiBaseUrl) || "http://localhost:3000";
  }

  function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  }

  function esc(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    setTimeout(() => el.classList.remove("is-visible"), 3400);
  }

  async function api(path, options) {
    const url = `${getApiOrigin().replace(/\/+$/, "")}${path}`;
    const opts = Object.assign({ method: "GET", headers: {} }, options || {});
    opts.headers = Object.assign(
      { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      opts.headers
    );
    const res = await fetch(url, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        window.location.href = "login.html";
      } else if (res.status === 403) {
        toast("Acceso restringido a cuentas Superadmin");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1200);
      }
      throw new Error((json && json.error) || `HTTP ${res.status}`);
    }
    return json;
  }

  let overviewData = null;

  // ==========================================================================
  // GRÁFICA 1: CONSUMO DE API VS CHATBOT POR EMPRESA (SVG BAR CHART)
  // ==========================================================================
  function renderCompanyUsageChart(companies) {
    const wrap = document.getElementById("companyUsageChart");
    if (!wrap) return;
    const top = (companies || []).slice(0, 7);
    if (!top.length) {
      wrap.innerHTML = `<p class="chart-empty">Sin empresas registradas aún.</p>`;
      return;
    }

    const maxVal = Math.max(
      10,
      ...top.map((c) => Math.max(c.apiCalls || 0, c.chatbotMsgs || 0))
    );
    const rowH = 44;
    const width = 560;
    const labelW = 155;
    const chartW = width - labelW - 58;
    const height = top.length * rowH + 22;

    const bars = top
      .map((c, idx) => {
        const y = idx * rowH + 10;
        const apiW = Math.max(4, Math.round(((c.apiCalls || 0) / maxVal) * chartW));
        const botW = Math.max(4, Math.round(((c.chatbotMsgs || 0) / maxVal) * chartW));
        const shortName = c.businessName.length > 20 ? c.businessName.slice(0, 19) + "…" : c.businessName;

        return `
          <g class="svg-bar-row">
            <text x="0" y="${y + 15}" fill="#1d1d1f" font-size="12" font-weight="600">${esc(shortName)}</text>
            <text x="0" y="${y + 29}" fill="#86868b" font-size="10">${esc(c.planTier)} · ${c.productCount} prod.</text>

            <rect x="${labelW}" y="${y + 3}" width="${apiW}" height="12" rx="6" fill="#0071e3">
              <title>${esc(c.businessName)} — API: ${c.apiCalls}</title>
            </rect>
            <text x="${labelW + apiW + 7}" y="${y + 13}" fill="#0071e3" font-size="11" font-weight="600">${c.apiCalls}</text>

            <rect x="${labelW}" y="${y + 19}" width="${botW}" height="12" rx="6" fill="#16a34a">
              <title>${esc(c.businessName)} — Chatbot: ${c.chatbotMsgs}</title>
            </rect>
            <text x="${labelW + botW + 7}" y="${y + 29}" fill="#16a34a" font-size="11" font-weight="600">${c.chatbotMsgs}</text>
          </g>
        `;
      })
      .join("");

    wrap.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="analytics-svg" role="img" aria-label="Gráfica de consumo de API y Chatbot por empresa">
        ${bars}
      </svg>
    `;
  }

  // ==========================================================================
  // GRÁFICA 2: TENDENCIA 7 DÍAS (SVG DUAL LINE + AREA) + DISTRIBUCIÓN PLANES
  // ==========================================================================
  function renderDailyTrendChart(dailyTrend, plans) {
    const wrap = document.getElementById("dailyTrendChart");
    const distBox = document.getElementById("planDistributionBox");
    if (wrap) {
      const days = dailyTrend || [];
      const w = 440;
      const h = 175;
      const padL = 28;
      const padR = 16;
      const padT = 18;
      const padB = 28;
      const innerW = w - padL - padR;
      const innerH = h - padT - padB;
      const maxY = Math.max(5, ...days.map((d) => Math.max(d.api_calls || 0, d.chatbot_msgs || 0)));

      const stepX = days.length > 1 ? innerW / (days.length - 1) : innerW;
      const apiPts = days.map((d, i) => [
        padL + i * stepX,
        padT + innerH - ((d.api_calls || 0) / maxY) * innerH
      ]);
      const botPts = days.map((d, i) => [
        padL + i * stepX,
        padT + innerH - ((d.chatbot_msgs || 0) / maxY) * innerH
      ]);

      const toPath = (pts) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
      const apiArea = `${toPath(apiPts)} L${(padL + innerW).toFixed(1)},${padT + innerH} L${padL},${padT + innerH} Z`;

      wrap.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" class="analytics-svg" role="img" aria-label="Tendencia de consumo de los últimos 7 días">
          <defs>
            <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0071e3" stop-opacity="0.26"/>
              <stop offset="100%" stop-color="#0071e3" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <line x1="${padL}" y1="${padT + innerH}" x2="${w - padR}" y2="${padT + innerH}" stroke="#e5e5ea" stroke-width="1"/>
          <path d="${apiArea}" fill="url(#apiGrad)"/>
          <path d="${toPath(apiPts)}" fill="none" stroke="#0071e3" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${toPath(botPts)}" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${apiPts
            .map(
              (p, i) =>
                `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#0071e3"><title>${days[i].label}: ${days[i].api_calls} API</title></circle>`
            )
            .join("")}
          ${botPts
            .map(
              (p, i) =>
                `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="#16a34a"><title>${days[i].label}: ${days[i].chatbot_msgs} Chatbot</title></circle>`
            )
            .join("")}
          ${days
            .map(
              (d, i) =>
                `<text x="${(padL + i * stepX).toFixed(1)}" y="${h - 8}" text-anchor="middle" fill="#86868b" font-size="10">${esc(d.label)}</text>`
            )
            .join("")}
        </svg>
      `;
    }

    if (distBox && plans) {
      const total = Math.max(1, (plans.ESTANDAR || 0) + (plans.PRO || 0) + (plans.GOLD || 0));
      const pStd = Math.round(((plans.ESTANDAR || 0) / total) * 100);
      const pPro = Math.round(((plans.PRO || 0) / total) * 100);
      const pGld = Math.round(((plans.GOLD || 0) / total) * 100);

      distBox.innerHTML = `
        <div class="plan-dist-bar" title="Distribución de planes">
          <span style="width:${pStd}%;background:#64748b"></span>
          <span style="width:${pPro}%;background:#0071e3"></span>
          <span style="width:${pGld}%;background:#d4a853"></span>
        </div>
        <div class="plan-dist-labels">
          <span>Estándar: <strong>${plans.ESTANDAR || 0}</strong></span>
          <span>Pro: <strong>${plans.PRO || 0}</strong></span>
          <span>Gold: <strong>${plans.GOLD || 0}</strong></span>
        </div>
      `;
    }
  }

  // ==========================================================================
  // TABLA DE EMPRESAS / USUARIOS + AUDITORÍA
  // ==========================================================================
  function renderUsersTable(filterText) {
    const tbody = document.getElementById("admUsersBody");
    if (!tbody || !overviewData) return;
    const q = String(filterText || "").toLowerCase().trim();
    const list = q
      ? overviewData.companies.filter(
          (c) =>
            c.businessName.toLowerCase().includes(q) ||
            c.fullName.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        )
      : overviewData.companies;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#6e6e73;">No hay resultados para tu búsqueda.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map(
        (u) => `
        <tr class="${u.isActive ? "" : "row-suspended"}">
          <td>
            <strong>${esc(u.businessName)}</strong>
            ${u.isActive ? "" : '<span class="status-pill status-pill--revoked" style="margin-left:6px;">Suspendida</span>'}<br />
            <small style="color:#6e6e73;">${esc(u.fullName)} · ${esc(u.email)}</small>
          </td>
          <td>
            <span class="dash-pill ${u.role === "SUPERADMIN" ? "dash-pill--super" : "dash-pill--pay-light"}">${esc(u.role)}</span>
          </td>
          <td>
            <select class="inline-select" data-adm-plan="${esc(u.id)}">
              <option value="ESTANDAR"${u.planTier === "ESTANDAR" ? " selected" : ""}>Estándar</option>
              <option value="PRO"${u.planTier === "PRO" ? " selected" : ""}>Pro</option>
              <option value="GOLD"${u.planTier === "GOLD" ? " selected" : ""}>Gold</option>
            </select>
          </td>
          <td>
            <strong>${u.apiCalls}</strong> API · <strong>${u.chatbotMsgs}</strong> Bot<br />
            <small style="color:#6e6e73;">${u.productCount} prod. · ${u.bankVerifies} banco</small>
          </td>
          <td>
            <button type="button" class="status-pill ${u.botEnabled ? "status-pill--active" : "status-pill--revoked"}" style="border:0;cursor:pointer;" data-adm-bot="${esc(u.id)}" data-adm-bot-val="${u.botEnabled ? "false" : "true"}">
              ${u.botEnabled ? "Bot ON" : "Bot OFF"}
            </button>
          </td>
          <td>
            <div class="table-actions">
              <button type="button" class="btn btn--secondary btn--xs" data-adm-role="${esc(u.id)}" data-adm-role-val="${u.role === "SUPERADMIN" ? "USER" : "SUPERADMIN"}">
                ${u.role === "SUPERADMIN" ? "Hacer User" : "Hacer Admin"}
              </button>
              <button type="button" class="btn btn--secondary btn--xs" data-adm-rotate="${esc(u.id)}">Rotar Key</button>
              <button type="button" class="btn btn--ghost-dark btn--xs" data-adm-active="${esc(u.id)}" data-adm-active-val="${u.isActive ? "false" : "true"}">
                ${u.isActive ? "Suspender" : "Activar"}
              </button>
              <button type="button" class="btn btn--ghost-dark btn--xs" data-adm-delete="${esc(u.id)}" data-adm-email="${esc(u.email)}">Eliminar</button>
            </div>
          </td>
        </tr>
      `
      )
      .join("");
  }

  function renderAuditLogs(logs) {
    const box = document.getElementById("admAuditLogs");
    if (!box) return;
    if (!logs || !logs.length) {
      box.innerHTML = `<p style="color:#6e6e73;font-size:0.86rem;">Sin eventos registrados todavía.</p>`;
      return;
    }
    box.innerHTML = logs
      .map(
        (l) => `
        <div class="audit-row">
          <div>
            <strong>${esc(l.operation)}</strong>
            <span>${esc(l.tenant_name || "Sistema")} — ${esc(l.description || "")}</span>
          </div>
          <time>${new Date(l.created_at).toLocaleString("es-VE")}</time>
        </div>
      `
      )
      .join("");
  }

  function hydrateBankForm(cfg) {
    if (!cfg) return;
    document.getElementById("admBankProvider").value = cfg.provider || "MERCANTIL";
    document.getElementById("admBankMode").value = cfg.verificationMode || "MANUAL";
    document.getElementById("admBankUrl").value = cfg.apiBaseUrl || "";
    document.getElementById("admBankPhone").value = cfg.accountPhone || "0424-6003606";
    document.getElementById("admBankRif").value = cfg.accountRif || "V-31.091.406";
    document.getElementById("admBankModePill").textContent = `${cfg.provider || "MERCANTIL"} · ${cfg.verificationMode || "MANUAL"}`;
  }

  async function loadOverview() {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }
    try {
      const userRaw = localStorage.getItem(AUTH_USER_KEY);
      if (userRaw) {
        const u = JSON.parse(userRaw);
        document.getElementById("adminEmailPill").textContent = u.email || "";
      }
      overviewData = await api("/api/admin/overview");
      const t = overviewData.totals;
      document.getElementById("admTotalUsers").textContent = String(t.totalUsers);
      document.getElementById("admSuperCount").textContent = `${t.superadmins} Superadmin(s)`;
      document.getElementById("admActiveBots").textContent = String(t.activeBots);
      document.getElementById("admTotalProducts").textContent = `${t.totalProducts} productos en catálogo`;
      document.getElementById("admTotalApiCalls").textContent = String(t.totalApiCalls);
      document.getElementById("admTotalChatMsgs").textContent = String(t.totalChatbotMsgs);

      renderCompanyUsageChart(overviewData.companies);
      renderDailyTrendChart(overviewData.dailyTrend, t.plans);
      renderUsersTable(document.getElementById("admUserSearch").value);
      renderAuditLogs(overviewData.recentLogs);
      hydrateBankForm(overviewData.globalBank);
    } catch (err) {
      toast("Error cargando Superadmin: " + err.message);
    }
  }

  function bindAdminEvents() {
    document.getElementById("adminRefreshBtn").addEventListener("click", () => {
      loadOverview().then(() => toast("Analíticas actualizadas"));
    });

    document.getElementById("adminLogoutBtn").addEventListener("click", () => {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      window.location.href = "login.html";
    });

    // 1. Crear Usuario Común (USER)
    document.getElementById("adminCreateUserForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("admNewPass").value;
      const confirmPassword = document.getElementById("admNewPassConfirm").value;
      if (password !== confirmPassword) {
        toast("Las contraseñas no coinciden");
        return;
      }
      try {
        await api("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            fullName: document.getElementById("admNewName").value.trim(),
            businessName: document.getElementById("admNewBusiness").value.trim(),
            email: document.getElementById("admNewEmail").value.trim(),
            phone: document.getElementById("admNewPhone").value.trim(),
            role: "USER",
            planTier: document.getElementById("admNewPlan").value,
            businessType: document.getElementById("admNewRubro").value,
            password,
            confirmPassword
          })
        });
        e.target.reset();
        toast("Usuario común creado y cifrado en Neon PostgreSQL");
        await loadOverview();
      } catch (err) {
        toast("Error creando usuario: " + err.message);
      }
    });

    // 2. Crear Superusuario (SUPERADMIN)
    document.getElementById("adminCreateSuperForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("admSuperPass").value;
      const confirmPassword = document.getElementById("admSuperPassConfirm").value;
      if (password !== confirmPassword) {
        toast("Las contraseñas del Superusuario no coinciden");
        return;
      }
      try {
        await api("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            fullName: document.getElementById("admSuperName").value.trim(),
            businessName: document.getElementById("admSuperBusiness").value.trim() || "Ckekea Admin",
            email: document.getElementById("admSuperEmail").value.trim(),
            phone: document.getElementById("admSuperPhone").value.trim(),
            role: "SUPERADMIN",
            planTier: "GOLD",
            businessType: "TECH",
            paymentStatus: "PAID",
            password,
            confirmPassword
          })
        });
        e.target.reset();
        document.getElementById("admSuperBusiness").value = "Ckekea Admin";
        toast("Superusuario creado con privilegios totales en Neon DB");
        await loadOverview();
      } catch (err) {
        toast("Error creando Superusuario: " + err.message);
      }
    });

    // Guardar configuración bancaria global
    document.getElementById("adminBankForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const res = await api("/api/admin/bank-global", {
          method: "PUT",
          body: JSON.stringify({
            provider: document.getElementById("admBankProvider").value,
            verificationMode: document.getElementById("admBankMode").value,
            apiBaseUrl: document.getElementById("admBankUrl").value.trim(),
            apiKey: document.getElementById("admBankKey").value.trim(),
            clientSecret: document.getElementById("admBankSecret").value.trim(),
            accountPhone: document.getElementById("admBankPhone").value.trim(),
            accountRif: document.getElementById("admBankRif").value.trim(),
            autoApprove: true
          })
        });
        document.getElementById("admBankKey").value = "";
        document.getElementById("admBankSecret").value = "";
        hydrateBankForm(res.config);
        toast("Configuración de API Bancaria guardada");
      } catch (err) {
        toast("Error guardando banco: " + err.message);
      }
    });

    document.getElementById("adminTestBankBtn").addEventListener("click", async () => {
      const out = document.getElementById("adminBankTestOut");
      out.hidden = false;
      out.textContent = "Ejecutando verificación bancaria...";
      try {
        const res = await api("/api/bank/verify-payment", {
          method: "POST",
          body: JSON.stringify({ reference: "849201", amountUsd: 49, amountBs: 2572.5, payerPhone: "04141234567" })
        });
        out.textContent = JSON.stringify(res.data, null, 2);
      } catch (err) {
        out.textContent = err.message;
      }
    });

    // Búsqueda y acciones sobre tabla de usuarios
    document.getElementById("admUserSearch").addEventListener("input", (e) => renderUsersTable(e.target.value));

    document.getElementById("admUsersBody").addEventListener("change", async (e) => {
      const sel = e.target.closest("[data-adm-plan]");
      if (!sel) return;
      try {
        await api(`/api/admin/users/${encodeURIComponent(sel.dataset.admPlan)}`, {
          method: "PATCH",
          body: JSON.stringify({ planTier: sel.value })
        });
        toast(`Plan actualizado a ${sel.value}`);
        await loadOverview();
      } catch (err) {
        toast(err.message);
      }
    });

    document.getElementById("admUsersBody").addEventListener("click", async (e) => {
      const botBtn = e.target.closest("[data-adm-bot]");
      if (botBtn) {
        try {
          await api(`/api/admin/users/${encodeURIComponent(botBtn.dataset.admBot)}`, {
            method: "PATCH",
            body: JSON.stringify({ botEnabled: botBtn.dataset.admBotVal === "true" })
          });
          toast("Estado del bot actualizado");
          await loadOverview();
        } catch (err) {
          toast(err.message);
        }
        return;
      }

      const roleBtn = e.target.closest("[data-adm-role]");
      if (roleBtn) {
        try {
          await api(`/api/admin/users/${encodeURIComponent(roleBtn.dataset.admRole)}`, {
            method: "PATCH",
            body: JSON.stringify({ role: roleBtn.dataset.admRoleVal })
          });
          toast(`Rol actualizado a ${roleBtn.dataset.admRoleVal}`);
          await loadOverview();
        } catch (err) {
          toast(err.message);
        }
        return;
      }

      const activeBtn = e.target.closest("[data-adm-active]");
      if (activeBtn) {
        try {
          await api(`/api/admin/users/${encodeURIComponent(activeBtn.dataset.admActive)}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: activeBtn.dataset.admActiveVal === "true" })
          });
          toast("Estado de la cuenta actualizado");
          await loadOverview();
        } catch (err) {
          toast(err.message);
        }
        return;
      }

      const rotateBtn = e.target.closest("[data-adm-rotate]");
      if (rotateBtn) {
        try {
          const res = await api(`/api/admin/users/${encodeURIComponent(rotateBtn.dataset.admRotate)}/rotate-key`, {
            method: "POST"
          });
          toast(`Nueva API Key generada: ${res.user.apiKey.slice(0, 16)}...`);
          await loadOverview();
        } catch (err) {
          toast(err.message);
        }
        return;
      }

      const delBtn = e.target.closest("[data-adm-delete]");
      if (delBtn) {
        if (!window.confirm(`¿Eliminar definitivamente la cuenta ${delBtn.dataset.admEmail}?`)) return;
        try {
          await api(`/api/admin/users/${encodeURIComponent(delBtn.dataset.admDelete)}`, { method: "DELETE" });
          toast("Cuenta eliminada de Neon DB");
          await loadOverview();
        } catch (err) {
          toast(err.message);
        }
      }
    });

    // Exportar CSV de consumo por empresa
    document.getElementById("admExportCsvBtn").addEventListener("click", () => {
      if (!overviewData) return;
      const rows = [
        "empresa,usuario,correo,rol,plan,bot_activo,productos,api_calls,chatbot_msgs,validaciones_banco"
      ].concat(
        overviewData.companies.map((c) =>
          [
            `"${c.businessName.replace(/"/g, '""')}"`,
            `"${c.fullName.replace(/"/g, '""')}"`,
            c.email,
            c.role,
            c.planTier,
            c.botEnabled,
            c.productCount,
            c.apiCalls,
            c.chatbotMsgs,
            c.bankVerifies
          ].join(",")
        )
      );
      const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ckekea-consumo-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Reporte CSV de consumo descargado");
    });

    // Cambio de contraseña del Superadmin
    document.getElementById("adminChangePassForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const newPassword = document.getElementById("admNextPass").value;
      const confirmNewPassword = document.getElementById("admNextPassConfirm").value;
      if (newPassword !== confirmNewPassword) {
        toast("La nueva contraseña y su confirmación no coinciden");
        return;
      }
      try {
        await api("/api/auth/change-password", {
          method: "PUT",
          body: JSON.stringify({
            currentPassword: document.getElementById("admCurPass").value,
            newPassword,
            confirmNewPassword
          })
        });
        e.target.reset();
        toast("Contraseña Superadmin actualizada correctamente");
      } catch (err) {
        toast("Error: " + err.message);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindAdminEvents();
    loadOverview();
  });
})();
