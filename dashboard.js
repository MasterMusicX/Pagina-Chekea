/**
 * ============================================================================
 * CKEKEA — LÓGICA DE LOGIN, REGISTRO Y DASHBOARD PRIVADO DE CLIENTE
 * ============================================================================
 * Conecta login.html y dashboard.html con server/server.js (Neon PostgreSQL)
 * y el motor independiente de WhatsApp Bot embebido.
 */

(function () {
  "use strict";

  const AUTH_TOKEN_KEY = "ckekea_auth_jwt_v1";
  const AUTH_USER_KEY = "ckekea_auth_user_v1";
  const page = (document.body.getAttribute("data-page") || "").toLowerCase();

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

  function saveAuth(token, client) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(client));
    // Sincronizar también con el portal desbloqueado de app.js
    try {
      localStorage.setItem(
        "ckekea_active_client_access_v3",
        JSON.stringify({
          tenantId: client.tenantId,
          customerName: client.businessName || client.fullName,
          customerEmail: client.email,
          customerPhone: client.whatsappPhone || client.phone || "",
          businessType: client.businessType || "RETAIL",
          planId: (client.planTier || "PRO").toLowerCase(),
          planEnum: client.planTier === "ESTANDAR" ? "LITE" : "PRO",
          clientBotPlan: client.planTier || "PRO",
          planName: client.planTier || "PRO",
          apiKey: client.apiKey,
          unlockedAt: new Date().toISOString()
        })
      );
    } catch {
      // silencioso
    }
  }

  function clearAuth() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
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

  async function apiRequest(path, options) {
    const url = `${getApiOrigin().replace(/\/+$/, "")}${path}`;
    const opts = Object.assign({ method: "GET", headers: {} }, options || {});
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers);
    const token = getToken();
    if (token) opts.headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, opts);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && page === "dashboard") {
        clearAuth();
        window.location.href = "login.html";
      }
      throw new Error((json && json.error) || `Error HTTP ${res.status}`);
    }
    return json;
  }

  // ==========================================================================
  // PÁGINA LOGIN / REGISTRO (login.html)
  // ==========================================================================
  function initLoginPage() {
    if (getToken()) {
      window.location.href = "dashboard.html";
      return;
    }

    const alertBox = document.getElementById("authAlert");
    const showAlert = (msg, isSuccess) => {
      if (!alertBox) return;
      alertBox.hidden = false;
      alertBox.className = `auth-alert ${isSuccess ? "auth-alert--ok" : "auth-alert--err"}`;
      alertBox.textContent = msg;
    };

    const switchTab = (tabName) => {
      document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
        if (btn.classList.contains("auth-tab")) {
          const active = btn.dataset.authTab === tabName;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", String(active));
        }
      });
      document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.authPanel === tabName);
      });
      if (alertBox) alertBox.hidden = true;
    };

    document.querySelectorAll("[data-auth-tab]").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.authTab));
    });

    if (window.location.hash === "#register") switchTab("register");

    // Configuración rápida del origen API cuando se despliega en GitHub Pages
    const originInput = document.getElementById("platformApiOriginInput");
    const saveOriginBtn = document.getElementById("savePlatformOriginBtn");
    if (originInput) originInput.value = getApiOrigin();
    if (saveOriginBtn && originInput) {
      saveOriginBtn.addEventListener("click", () => {
        const val = originInput.value.trim().replace(/\/+$/, "");
        if (val) {
          localStorage.setItem("ckekea_platform_api_url", val);
          showAlert("URL del servidor API guardada: " + val, true);
        } else {
          localStorage.removeItem("ckekea_platform_api_url");
          showAlert("URL del servidor restablecida al valor por defecto.", true);
        }
      });
    }

    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("loginSubmitBtn");
        btn.disabled = true;
        btn.textContent = "Verificando credenciales...";
        try {
          const data = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
              email: document.getElementById("loginEmail").value.trim(),
              password: document.getElementById("loginPassword").value
            })
          });
          saveAuth(data.token, data.client);
          showAlert("Sesión iniciada correctamente. Redirigiendo...", true);
          window.location.href = data.client && data.client.role === "SUPERADMIN" ? "admin.html" : "dashboard.html";
        } catch (err) {
          showAlert(err.message + " (Verifica que el servidor backend esté activo)", false);
        } finally {
          btn.disabled = false;
          btn.textContent = "Entrar a mi Dashboard";
        }
      });
    }

    const regForm = document.getElementById("registerForm");
    if (regForm) {
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const password = document.getElementById("regPassword").value;
        const confirmPassword = document.getElementById("regPasswordConfirm").value;
        if (password !== confirmPassword) {
          showAlert("Las contraseñas no coinciden. Verifica ambos campos.", false);
          return;
        }
        const btn = document.getElementById("registerSubmitBtn");
        btn.disabled = true;
        btn.textContent = "Creando cuenta en Neon PostgreSQL...";
        try {
          const data = await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
              fullName: document.getElementById("regFullName").value.trim(),
              businessName: document.getElementById("regBusinessName").value.trim(),
              businessType: document.getElementById("regBusinessType").value,
              planTier: document.getElementById("regPlanTier").value,
              email: document.getElementById("regEmail").value.trim(),
              phone: document.getElementById("regPhone").value.trim(),
              password,
              confirmPassword
            })
          });
          saveAuth(data.token, data.client);
          showAlert("Cuenta creada con contraseña cifrada. Entrando a tu Dashboard...", true);
          window.location.href = "dashboard.html";
        } catch (err) {
          showAlert(err.message, false);
        } finally {
          btn.disabled = false;
          btn.textContent = "Crear cuenta y abrir Dashboard";
        }
      });
    }
  }

  // ==========================================================================
  // PÁGINA DASHBOARD PRIVADO (dashboard.html)
  // ==========================================================================
  function initDashboardPage() {
    if (!getToken()) {
      window.location.href = "login.html";
      return;
    }

    let currentClient = null;
    let inventoryItems = [];

    function renderBotPower(enabled) {
      const badge = document.getElementById("dashBotStateBadge");
      const btn = document.getElementById("dashBotToggleBtn");
      const txt = document.getElementById("dashBotToggleText");
      if (badge) {
        badge.className = `dash-pill dash-pill--bot ${enabled ? "is-on" : "is-off"}`;
        badge.textContent = enabled ? "● Bot ENCENDIDO" : "● Bot APAGADO";
      }
      if (btn) {
        btn.classList.toggle("is-on", enabled);
        btn.classList.toggle("is-off", !enabled);
      }
      if (txt) txt.textContent = enabled ? "Apagar Bot" : "Encender Bot";
    }

    function hydrateClientUI(client, stats) {
      currentClient = client;
      document.getElementById("dashBusinessTitle").textContent = `${client.businessName} — Panel de Control`;
      document.getElementById("dashUserSubtitle").textContent = `Hola, ${client.fullName} (${client.email}) · Tenant: ${client.tenantId}`;
      document.getElementById("dashPlanBadge").textContent = `PLAN ${client.planTier}`;
      document.getElementById("dashPayBadge").textContent =
        client.paymentStatus === "PAID" ? `PAGADO (Ref ${client.paymentReference || "Verificado"})` : "MODO PRUEBA";
      const superBtn = document.getElementById("dashSuperadminBtn");
      if (superBtn) superBtn.hidden = client.role !== "SUPERADMIN";
      document.getElementById("kpiApiKeyPreview").textContent = `${client.apiKey.slice(0, 14)}•••${client.apiKey.slice(-4)}`;
      document.getElementById("dashTestBotTitle").textContent = `Probar a ${client.botName || "Max"} con tu Inventario`;

      if (stats) {
        document.getElementById("kpiInvCount").textContent = String(stats.totalProducts || 0);
        document.getElementById("kpiInvUnits").textContent = String(stats.totalUnits || 0);
      }

      document.getElementById("setBotName").value = client.botName || "Max";
      document.getElementById("setBusinessName").value = client.businessName || "";
      document.getElementById("setBusinessType").value = client.businessType || "RETAIL";
      document.getElementById("setWhatsappPhone").value = client.whatsappPhone || "";
      document.getElementById("setHours").value = client.businessHours || "";
      document.getElementById("setDelivery").value = client.deliveryInfo || "";
      document.getElementById("dashPairingPhone").value = client.whatsappPhone || "";

      renderBotPower(Boolean(client.botEnabled));
    }

    async function loadProfile() {
      const data = await apiRequest("/api/auth/me");
      saveAuth(getToken(), data.client);
      hydrateClientUI(data.client, data.stats);
    }

    async function loadBotLiveStatus(silent) {
      try {
        const res = await apiRequest("/api/bot/status");
        const d = res.data;
        renderBotPower(Boolean(d.botEnabled));
        document.getElementById("kpiWaStatus").textContent = d.waStatus || "READY";
        document.getElementById("kpiRailwaySync").textContent = d.lastError
          ? d.lastError.slice(0, 48)
          : "Motor WhatsApp Independiente";

        const qrImg = document.getElementById("dashQrImg");
        const qrHolder = document.getElementById("dashQrPlaceholder");
        if (d.qrBase64 && d.waStatus !== "READY") {
          qrImg.src = d.qrBase64;
          qrImg.hidden = false;
          qrHolder.hidden = true;
        } else if (d.waStatus === "READY") {
          qrImg.hidden = true;
          qrHolder.hidden = false;
          qrHolder.innerHTML = `<strong>WhatsApp Conectado</strong><p>Tu bot está vinculado y listo para responder.</p>`;
        } else {
          qrImg.hidden = true;
          qrHolder.hidden = false;
          qrHolder.innerHTML = `<strong>Estado: ${esc(d.waStatus)}</strong><p>Abre el Panel Completo en Railway o solicita código de vinculación.</p>`;
        }
        if (!silent) toast("Estado del Bot y WhatsApp actualizado");
      } catch (err) {
        if (!silent) toast("Error consultando bot: " + err.message);
      }
    }

    function renderInventoryTable(filterText) {
      const tbody = document.getElementById("invTableBody");
      if (!tbody) return;
      const q = String(filterText || "").toLowerCase().trim();
      const filtered = q
        ? inventoryItems.filter(
            (i) =>
              i.name.toLowerCase().includes(q) ||
              i.sku.toLowerCase().includes(q) ||
              String(i.activeIngredient || "").toLowerCase().includes(q)
          )
        : inventoryItems;

      document.getElementById("kpiInvCount").textContent = String(inventoryItems.length);
      const totalUnits = inventoryItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
      document.getElementById("kpiInvUnits").textContent = String(totalUnits);

      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:26px;color:#6e6e73;">Aún no tienes productos cargados. Sube un CSV/JSON o agrega tu primer producto arriba.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered
        .map(
          (item) => `
          <tr>
            <td><code>${esc(item.sku)}</code></td>
            <td><strong>${esc(item.name)}</strong><br /><small style="color:#6e6e73;">${esc(item.presentation)}</small></td>
            <td>${esc(item.activeIngredient)}</td>
            <td><strong>$${Number(item.price).toFixed(2)}</strong></td>
            <td>${item.quantity > 0 ? `<span class="status-pill status-pill--active">${item.quantity}</span>` : `<span class="status-pill status-pill--revoked">0</span>`}</td>
            <td><button type="button" class="btn btn--ghost-dark btn--xs" data-del-prod="${esc(item.id)}">Quitar</button></td>
          </tr>
        `
        )
        .join("");
    }

    async function loadInventory() {
      const res = await apiRequest("/api/inventory");
      inventoryItems = res.items || [];
      renderInventoryTable(document.getElementById("invSearchInput").value);
    }

    function appendTestMsg(text, sender, meta) {
      const box = document.getElementById("dashTestChatMessages");
      if (!box) return;
      const div = document.createElement("div");
      div.className = `chat-msg chat-msg--${sender}`;
      const htmlText = esc(text)
        .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br />");
      div.innerHTML = `${htmlText}<span class="chat-msg__meta">${esc(meta || (sender === "user" ? "Tú" : "Tu Bot"))}</span>`;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
    }

    async function sendTestBotMessage(msg) {
      const clean = msg.trim();
      if (!clean) return;
      appendTestMsg(clean, "user", "Cliente de prueba");
      try {
        const res = await apiRequest("/api/bot/chat", {
          method: "POST",
          body: JSON.stringify({ message: clean })
        });
        appendTestMsg(res.reply, "bot", res.source || "Tu Bot");
      } catch (err) {
        appendTestMsg("Error probando el bot: " + err.message, "bot", "Sistema");
      }
    }

    // Toggle Encender / Apagar Bot a voluntad
    document.getElementById("dashBotToggleBtn").addEventListener("click", async () => {
      if (!currentClient) return;
      const nextState = !currentClient.botEnabled;
      try {
        const res = await apiRequest("/api/bot/toggle", {
          method: "POST",
          body: JSON.stringify({ active: nextState })
        });
        currentClient.botEnabled = res.botEnabled;
        renderBotPower(res.botEnabled);
        toast(res.botEnabled ? "Bot ENCENDIDO (motor independiente activo)" : "Bot APAGADO (en pausa)");
      } catch (err) {
        toast("Error cambiando estado del Bot: " + err.message);
      }
    });

    document.getElementById("dashRefreshBotBtn").addEventListener("click", () => loadBotLiveStatus(false));

    const handleRestartWa = async () => {
      toast("Reiniciando motor WhatsApp y generando QR...");
      try {
        await apiRequest("/api/bot/restart", { method: "POST", body: "{}" });
        setTimeout(() => loadBotLiveStatus(false), 1800);
      } catch (err) {
        toast("Error reiniciando WhatsApp: " + err.message);
      }
    };
    const restartBtn1 = document.getElementById("dashRestartBotBtn");
    const restartBtn2 = document.getElementById("dashRestartWaInlineBtn");
    if (restartBtn1) restartBtn1.addEventListener("click", handleRestartWa);
    if (restartBtn2) restartBtn2.addEventListener("click", handleRestartWa);

    document.getElementById("dashCopyApiKeyBtn").addEventListener("click", () => {
      if (!currentClient) return;
      navigator.clipboard.writeText(currentClient.apiKey).then(() => toast("X-API-Key copiada al portapapeles"));
    });

    document.getElementById("dashLogoutBtn").addEventListener("click", () => {
      clearAuth();
      window.location.href = "login.html";
    });

    // Pairing code WhatsApp
    document.getElementById("dashPairingForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const out = document.getElementById("dashPairingOut");
      out.hidden = false;
      out.textContent = "Solicitando código de vinculación a Railway...";
      try {
        const res = await apiRequest("/api/bot/pairing-code", {
          method: "POST",
          body: JSON.stringify({ phone: document.getElementById("dashPairingPhone").value })
        });
        out.textContent = `Código WhatsApp: ${JSON.stringify(res.data)}`;
      } catch (err) {
        out.textContent = err.message;
      }
    });

    // Guardar configuración del negocio
    document.getElementById("dashBotSettingsForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const res = await apiRequest("/api/bot/settings", {
          method: "PUT",
          body: JSON.stringify({
            botName: document.getElementById("setBotName").value,
            businessName: document.getElementById("setBusinessName").value,
            businessType: document.getElementById("setBusinessType").value,
            whatsappPhone: document.getElementById("setWhatsappPhone").value,
            businessHours: document.getElementById("setHours").value,
            deliveryInfo: document.getElementById("setDelivery").value
          })
        });
        saveAuth(getToken(), res.client);
        hydrateClientUI(res.client);
        toast("Configuración guardada en Neon PostgreSQL");
      } catch (err) {
        toast("Error guardando configuración: " + err.message);
      }
    });

    // Descargar plantilla CSV
    document.getElementById("downloadCsvTemplateBtn").addEventListener("click", () => {
      const sample = [
        "sku,nombre,precio,stock,categoria,presentacion,marca",
        "PRO-001,Acetaminofen 500mg,2.50,45,ANALGESICO,Caja x 10 tabletas,Genfar",
        "PRO-002,Vitamina C 1000mg,6.80,30,VITAMINAS,Frasco x 30 tabletas,Now",
        "PRO-003,Termometro Digital Infrarrojo,18.00,12,EQUIPOS,Unidad,Omron"
      ].join("\n");
      const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantilla-inventario-sinkroo.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast("Plantilla CSV descargada");
    });

    // Descargar .env.client-bot
    document.getElementById("dashDownloadEnvBtn").addEventListener("click", () => {
      if (!currentClient) return;
      const env = [
        `CLIENT_PLAN=${currentClient.planTier}`,
        `CLIENT_BOT_NAME=${currentClient.botName || "Max"}`,
        `CLIENT_BUSINESS_NAME="${currentClient.businessName}"`,
        `CLIENT_BUSINESS_RUBRO="${currentClient.businessType}"`,
        `CLIENT_TENANT_ID=${currentClient.tenantId}`,
        `CLIENT_TENANT_EMAIL=${currentClient.email}`,
        `CLIENT_OWNER_PHONE=${currentClient.whatsappPhone || ""}`,
        `# X-API-Key: ${currentClient.apiKey}`
      ].join("\n");
      const blob = new Blob([env], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ".env.client-bot";
      a.click();
      URL.revokeObjectURL(url);
      toast("Archivo .env.client-bot descargado");
    });

    // Subir archivo CSV o JSON de inventario
    const invInput = document.getElementById("invFileInput");
    const invDrop = document.getElementById("invDropzone");
    document.getElementById("invBrowseBtn").addEventListener("click", () => invInput.click());

    async function handleInvFile(file) {
      if (!file) return;
      const text = await file.text();
      try {
        let payload;
        if (file.name.toLowerCase().endsWith(".json")) {
          const parsed = JSON.parse(text);
          payload = { items: Array.isArray(parsed) ? parsed : parsed.items || [] };
        } else {
          payload = { csvText: text };
        }
        const res = await apiRequest("/api/inventory/bulk", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        toast(res.message || `${res.imported} productos importados`);
        await loadInventory();
      } catch (err) {
        toast("Error importando archivo: " + err.message);
      }
    }

    invInput.addEventListener("change", (e) => handleInvFile(e.target.files[0]));
    ["dragenter", "dragover"].forEach((ev) =>
      invDrop.addEventListener(ev, (e) => {
        e.preventDefault();
        invDrop.classList.add("is-dragover");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      invDrop.addEventListener(ev, (e) => {
        e.preventDefault();
        invDrop.classList.remove("is-dragover");
      })
    );
    invDrop.addEventListener("drop", (e) => handleInvFile(e.dataTransfer.files[0]));

    // Agregar producto individual
    document.getElementById("addProductForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await apiRequest("/api/inventory", {
          method: "POST",
          body: JSON.stringify({
            sku: document.getElementById("prodSku").value.trim(),
            name: document.getElementById("prodName").value.trim(),
            price: Number(document.getElementById("prodPrice").value),
            quantity: parseInt(document.getElementById("prodQty").value, 10),
            activeIngredient: document.getElementById("prodCategory").value.trim() || "GENERAL",
            presentation: document.getElementById("prodPresentation").value.trim() || "Unidad"
          })
        });
        e.target.reset();
        toast("Producto guardado en Neon y asimilado por el Bot");
        await loadInventory();
      } catch (err) {
        toast("Error guardando producto: " + err.message);
      }
    });

    // Buscar y borrar productos
    document.getElementById("invSearchInput").addEventListener("input", (e) => renderInventoryTable(e.target.value));
    document.getElementById("invTableBody").addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-del-prod]");
      if (!btn) return;
      try {
        await apiRequest(`/api/inventory/${encodeURIComponent(btn.dataset.delProd)}`, { method: "DELETE" });
        toast("Producto retirado del inventario");
        await loadInventory();
      } catch (err) {
        toast("Error eliminando producto: " + err.message);
      }
    });

    // Probador de Chat con Inventario
    document.getElementById("dashTestChatForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = document.getElementById("dashTestChatInput");
      sendTestBotMessage(inp.value);
      inp.value = "";
    });
    document.querySelectorAll(".dash-test-chip").forEach((c) => {
      c.addEventListener("click", () => sendTestBotMessage(c.dataset.testMsg));
    });
    document.getElementById("dashClearTestChat").addEventListener("click", () => {
      document.getElementById("dashTestChatMessages").innerHTML = "";
      appendTestMsg("¡Listo! Pregúntame por cualquier producto que hayas cargado arriba para comprobar que ya lo asimilé.", "bot", "Tu Bot");
    });

    // Cargar y guardar API Bancaria del comercio
    async function loadBankConfig() {
      try {
        const res = await apiRequest("/api/bank/config");
        const c = res.config;
        if (!c) return;
        document.getElementById("uBankProvider").value = c.provider || "MERCANTIL";
        document.getElementById("uBankMode").value = c.verificationMode || "MANUAL";
        document.getElementById("uBankUrl").value = c.apiBaseUrl || "";
        document.getElementById("dashBankBadge").textContent = `${c.provider || "MERCANTIL"} · ${c.verificationMode || "MANUAL"}`;
      } catch {
        // silencioso
      }
    }

    const bankForm = document.getElementById("dashBankConfigForm");
    if (bankForm) {
      bankForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const res = await apiRequest("/api/bank/config", {
            method: "PUT",
            body: JSON.stringify({
              provider: document.getElementById("uBankProvider").value,
              verificationMode: document.getElementById("uBankMode").value,
              apiBaseUrl: document.getElementById("uBankUrl").value.trim(),
              apiKey: document.getElementById("uBankKey").value.trim(),
              clientSecret: document.getElementById("uBankSecret").value.trim(),
              autoApprove: true
            })
          });
          document.getElementById("uBankKey").value = "";
          document.getElementById("uBankSecret").value = "";
          document.getElementById("dashBankBadge").textContent = `${res.config.provider} · ${res.config.verificationMode}`;
          toast("Configuración de API Bancaria guardada en Neon DB");
        } catch (err) {
          toast("Error guardando API Bancaria: " + err.message);
        }
      });
    }

    const testBankBtn = document.getElementById("dashTestBankBtn");
    if (testBankBtn) {
      testBankBtn.addEventListener("click", async () => {
        const out = document.getElementById("dashBankTestOut");
        out.hidden = false;
        out.textContent = "Ejecutando prueba de conciliación bancaria...";
        try {
          const res = await apiRequest("/api/bank/verify-payment", {
            method: "POST",
            body: JSON.stringify({ reference: "849201", amountUsd: 49, amountBs: 2572.5, payerPhone: "04141234567" })
          });
          out.textContent = JSON.stringify(res.data, null, 2);
        } catch (err) {
          out.textContent = err.message;
        }
      });
    }

    // Cambio de contraseña desde el dashboard de usuario
    const changePassForm = document.getElementById("dashChangePasswordForm");
    if (changePassForm) {
      changePassForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById("newPassInput").value;
        const confirmNewPassword = document.getElementById("confirmNewPassInput").value;
        if (newPassword !== confirmNewPassword) {
          toast("La nueva contraseña y su confirmación no coinciden");
          return;
        }
        try {
          await apiRequest("/api/auth/change-password", {
            method: "PUT",
            body: JSON.stringify({
              currentPassword: document.getElementById("curPassInput").value,
              newPassword,
              confirmNewPassword
            })
          });
          changePassForm.reset();
          toast("Contraseña actualizada correctamente con cifrado scrypt");
        } catch (err) {
          toast("Error cambiando contraseña: " + err.message);
        }
      });
    }

    // Carga inicial paralela
    appendTestMsg("Hola. Aquí puedes probar cómo responde tu Bot usando exactamente el inventario que subas a Neon PostgreSQL.", "bot", "Simulador Real");
    Promise.all([loadProfile(), loadInventory(), loadBotLiveStatus(true), loadBankConfig()]).catch((err) => {
      toast("Error cargando Dashboard: " + err.message);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (page === "login") initLoginPage();
    if (page === "dashboard") initDashboardPage();
  });
})();
