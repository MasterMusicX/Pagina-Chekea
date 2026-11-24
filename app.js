/**
 * ============================================================================
 * CHEKEA — LÓGICA PRINCIPAL CONECTADA A TUS 2 SERVICIOS BACKEND
 * ============================================================================
 * 1) standalone-chatbot-api.ts (:3000)
 *    - POST /api/v1/chatbot/api-keys/generate  (crea Tenant + emite sk_live_... al pagar)
 *    - POST /api/v1/chatbot/message            (chat IA + soporte de imagen Base64 + conversation_id)
 *    - GET  /api/v1/chatbot/conversations      (historial de sesiones del tenant)
 *    - POST /api/v1/chatbot/rate/:queryId      (calificación útil / no útil)
 *
 * 2) client-sales-bot.ts (:3001)
 *    - GET  /api/state                         (estado bot, WhatsApp QR, resumen semanal)
 *    - POST /api/chat                          (chat directo contra el bot comercial)
 *    - POST /api/toggle                        (encender / apagar bot comercial)
 *    - GET  /api/reports/weekly-pdf            (descarga PDF de Cierre Semanal con X-Panel-Token)
 */

(function () {
  "use strict";

  const STORAGE_KEYS = {
    API_CONFIG: "chekea_api_config_v2",
    GENERATED_KEYS: "chekea_generated_keys_v2",
    EXCHANGE_RATE: "chekea_exchange_rate_v2",
    ACTIVE_ACCESS: "chekea_active_client_access_v2",
    WA_POPUP_SEEN: "chekea_wa_welcome_seen_v1"
  };

  const BASE = window.CHEKEA_CONFIG;
  const state = {
    billing: "monthly",
    exchangeRateBs: loadNumber(STORAGE_KEYS.EXCHANGE_RATE, BASE.payment.exchangeRateBs),
    apiConfig: Object.assign(
      {},
      structuredCloneSafe(BASE.apiStudio),
      loadJson(STORAGE_KEYS.API_CONFIG, {})
    ),
    generatedKeys: loadJson(STORAGE_KEYS.GENERATED_KEYS, []),
    // Acceso desbloqueado del cliente tras pagar o ingresar su X-API-Key
    activeAccess: loadJson(STORAGE_KEYS.ACTIVE_ACCESS, null),
    conversationId: null,
    pendingAttachment: null, // { base64, mimeType, filename }
    lastGeneratedKey: null
  };

  // ==========================================================================
  // UTILIDADES GENERALES
  // ==========================================================================
  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function loadNumber(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const num = Number(raw);
      return Number.isFinite(num) && num > 0 ? num : fallback;
    } catch {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEYS.API_CONFIG, JSON.stringify(state.apiConfig));
      localStorage.setItem(STORAGE_KEYS.GENERATED_KEYS, JSON.stringify(state.generatedKeys));
      localStorage.setItem(STORAGE_KEYS.EXCHANGE_RATE, String(state.exchangeRateBs));
      if (state.activeAccess) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ACCESS, JSON.stringify(state.activeAccess));
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_ACCESS);
      }
    } catch {
      // Continúa en memoria si el navegador restringe localStorage.
    }
  }

  function onId(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatBs(amountUsd) {
    const bs = amountUsd * state.exchangeRateBs;
    return new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(bs);
  }

  function formatRate(rate) {
    return new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rate);
  }

  function getPlanById(planId) {
    return BASE.plans.find((p) => p.id === planId) || BASE.plans[1];
  }

  function getPlanPriceUsd(plan) {
    if (state.billing === "annual") {
      const discount = 1 - BASE.payment.annualDiscountPercent / 100;
      return Math.round(plan.priceUsdMonthly * discount);
    }
    return plan.priceUsdMonthly;
  }

  function buildWhatsAppUrl(message) {
    return `https://wa.me/${BASE.payment.whatsappInternational}?text=${encodeURIComponent(message)}`;
  }

  function joinUrl(base, pathStr) {
    const cleanBase = String(base || "").trim().replace(/\/+$/, "");
    const cleanPath = String(pathStr || "").trim();
    if (!cleanBase) return "";
    if (!cleanPath) return cleanBase;
    return `${cleanBase}${cleanPath.startsWith("/") ? cleanPath : "/" + cleanPath}`;
  }

  function buildAuthHeaders(apiKey) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      const headerName = (state.apiConfig.authHeaderName || "X-API-Key").trim();
      if (headerName.toLowerCase() === "authorization") {
        headers[headerName] = `Bearer ${apiKey}`;
      } else {
        headers[headerName] = apiKey;
      }
      // Compatibilidad dual con authenticate() de standalone-chatbot-api.ts
      headers["X-API-Key"] = apiKey;
    }
    return headers;
  }

  function buildBotPanelHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (state.apiConfig.clientBotPanelToken) {
      headers["X-Panel-Token"] = state.apiConfig.clientBotPanelToken;
    }
    return headers;
  }

  let toastTimer = null;
  function showToast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 3400);
  }

  async function copyToClipboard(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg || "Copiado al portapapeles");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      showToast(successMsg || "Copiado al portapapeles");
    }
  }

  function generateFallbackApiKey(planId) {
    const plan = getPlanById(planId);
    const customPrefix = (state.apiConfig.customKeyPrefix || "sk_live_").trim();
    const tierSlug = plan.id === "estandar" ? "std_" : plan.id === "gold" ? "gld_" : "pro_";
    const prefix = customPrefix.endsWith("_") ? `${customPrefix}${tierSlug}` : `${customPrefix}_${tierSlug}`;

    const bytes = new Uint8Array(18);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${prefix}${hex}`;
  }

  function downloadFile(filename, content, mimeType) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ==========================================================================
  // PORTAL DE ACCESO DESBLOQUEADO (TRAS PAGAR O INGRESAR API KEY)
  // ==========================================================================
  function renderAccessPortal() {
    const unlocked = Boolean(state.activeAccess && state.activeAccess.apiKey);
    const pill = document.getElementById("accessStatusPill");
    const meta = document.getElementById("accessStatusMeta");
    const primaryCta = document.getElementById("accessPrimaryCta");
    const openUnlockBtn = document.getElementById("openUnlockModalBtn");
    const logoutBtn = document.getElementById("logoutAccessBtn");
    const navAccessBtn = document.getElementById("navAccessBtn");
    const portal = document.getElementById("unlockedPortal");
    const lockBanner = document.getElementById("chatLockBanner");
    const engineSelect = document.getElementById("chatEngineSelect");

    if (unlocked) {
      const a = state.activeAccess;
      if (pill) {
        pill.className = "access-pill access-pill--unlocked";
        pill.textContent = `✅ Acceso Activo — Plan ${a.planEnum || a.planName} Desbloqueado`;
      }
      if (meta) {
        meta.innerHTML = `Sesión activa para <strong>${escapeHtml(a.customerName)}</strong> (${escapeHtml(a.businessType || "RETAIL")}). Tu Bot Comercial y API están listos para usar.`;
      }
      if (primaryCta) primaryCta.hidden = true;
      if (openUnlockBtn) openUnlockBtn.hidden = true;
      if (logoutBtn) logoutBtn.hidden = false;
      if (navAccessBtn) navAccessBtn.textContent = `Plan ${a.planEnum || "Activo"} ✓`;
      if (portal) portal.hidden = false;
      if (lockBanner) lockBanner.hidden = true;
      if (engineSelect) engineSelect.disabled = false;

      // Rellenar credenciales reales del portal
      const chatUrl = joinUrl(state.apiConfig.baseUrl, state.apiConfig.chatEndpoint || "/api/v1/chatbot/message");
      const stockUrl = joinUrl(state.apiConfig.baseUrl, state.apiConfig.stockSyncEndpoint || "/api/v1/stock/import");
      const botQrUrl = joinUrl(state.apiConfig.clientBotBaseUrl, "/qr");

      document.getElementById("portalClientTitle").textContent = `${a.customerName} — API Activa`;
      document.getElementById("portalPlanBadge").textContent = `PLAN ${a.planEnum || "PRO"}`;
      document.getElementById("portalApiKeyText").textContent = a.apiKey;
      document.getElementById("portalTenantMeta").textContent = `${a.tenantId || "local-tenant"} · ${a.businessType || "RETAIL"}`;
      document.getElementById("portalChatEndpointText").textContent = `POST ${chatUrl}`;
      document.getElementById("portalStockEndpointText").textContent = `POST ${stockUrl}`;
      const botLink = document.getElementById("openBotPanelLink");
      if (botLink) {
        botLink.href = state.apiConfig.clientBotPanelToken
          ? `${botQrUrl}?token=${encodeURIComponent(state.apiConfig.clientBotPanelToken)}`
          : botQrUrl;
      }

      updateChatStatusBadge();
      syncClientBotState(true);
    } else {
      if (pill) {
        pill.className = "access-pill access-pill--locked";
        pill.textContent = "🔒 Acceso Bloqueado — Requiere Plan Activo";
      }
      if (meta) {
        meta.innerHTML = `Completa tu Pago Móvil Mercantil para recibir tu <code>X-API-Key</code>, activar el Chatbot API y conectar tu Bot Comercial de WhatsApp.`;
      }
      if (primaryCta) primaryCta.hidden = false;
      if (openUnlockBtn) openUnlockBtn.hidden = false;
      if (logoutBtn) logoutBtn.hidden = true;
      if (navAccessBtn) navAccessBtn.textContent = "Ya tengo API Key";
      if (portal) portal.hidden = true;
      if (lockBanner) lockBanner.hidden = false;
      if (engineSelect) engineSelect.disabled = true;
      updateChatStatusBadge();
    }
  }

  function unlockClientAccess(accessObj) {
    state.activeAccess = accessObj;
    state.lastGeneratedKey = accessObj.apiKey;
    state.conversationId = null;
    saveState();
    renderAccessPortal();
    renderCodeSnippets();
  }

  // Sincronizar estado real de client-sales-bot.ts (:3001/api/state)
  async function syncClientBotState(silent) {
    const botBase = state.apiConfig.clientBotBaseUrl;
    const statusPill = document.getElementById("botLiveStatusPill");
    const qrImg = document.getElementById("botQrImg");
    const qrPlaceholder = document.getElementById("botQrPlaceholder");
    const titleEl = document.getElementById("botServiceTitle");
    const descEl = document.getElementById("botLiveDesc");

    if (!botBase) return;
    if (statusPill && !silent) statusPill.textContent = "Conectando...";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(joinUrl(botBase, state.apiConfig.clientBotStateEndpoint || "/api/state"), {
        headers: buildBotPanelHeaders(),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("Respuesta inválida");

      const d = json.data;
      if (titleEl) titleEl.textContent = `${d.botName} — ${d.businessName} (Plan ${d.plan})`;
      if (statusPill) {
        statusPill.className = `status-pill ${d.botActive ? "status-pill--active" : "status-pill--revoked"}`;
        statusPill.textContent = `${d.botActive ? "Bot ON" : "Bot OFF"} · WA: ${d.waStatus}`;
      }
      if (descEl) {
        descEl.textContent = `Conectado en vivo a ${botBase}. Período semanal: ${d.weekly.periodStart} al ${d.weekly.periodEnd}.`;
      }
      document.getElementById("kpiWeeklySold").textContent = `$${Number(d.weekly.totalSold || 0).toFixed(2)}`;
      document.getElementById("kpiWeeklyPaid").textContent = String(d.weekly.paidCount || 0);
      document.getElementById("kpiWeeklyPending").textContent = String(d.weekly.pendingCount || 0);

      if (d.qrBase64 && d.waStatus !== "READY") {
        qrImg.src = d.qrBase64;
        qrImg.hidden = false;
        qrPlaceholder.hidden = true;
      } else if (d.waStatus === "READY") {
        qrImg.hidden = true;
        qrPlaceholder.hidden = false;
        qrPlaceholder.innerHTML = `<strong>✅ WhatsApp Conectado</strong><span>El bot está atendiendo clientes en vivo.</span>`;
      } else {
        qrImg.hidden = true;
        qrPlaceholder.hidden = false;
        qrPlaceholder.innerHTML = `<strong>Estado: ${escapeHtml(d.waStatus)}</strong><span>Abre el Panel QR o espera unos segundos mientras inicializa.</span>`;
      }

      if (!silent) showToast("Bot Comercial sincronizado en vivo");
    } catch (err) {
      if (statusPill) {
        statusPill.className = "status-pill status-pill--revoked";
        statusPill.textContent = "Bot Offline (:3001)";
      }
      if (descEl) {
        descEl.innerHTML = `No se detectó <code>client-sales-bot.ts</code> en <code>${escapeHtml(botBase)}</code> (${escapeHtml(err.message)}). Inicia tu servidor con <code>npm run dev:client-bot</code> y pulsa <strong>Sincronizar Bot</strong>.`;
      }
      if (!silent) showToast("No se pudo conectar al Bot Comercial en " + botBase);
    }
  }

  // Descargar .env.client-bot preconfigurado para desplegar client-sales-bot.ts para este cliente
  function downloadClientEnvTemplate() {
    const a = state.activeAccess;
    if (!a) return;
    const envText = [
      `# Configuración generada automáticamente desde Chekea para ${a.customerName}`,
      `CLIENT_PLAN=${a.planEnum || "PRO"}`,
      `CLIENT_BOT_NAME=Sofía`,
      `CLIENT_BUSINESS_NAME="${a.customerName}"`,
      `CLIENT_BUSINESS_RUBRO="${a.businessType || "RETAIL"}"`,
      `CLIENT_TENANT_ID=${a.tenantId || ""}`,
      `CLIENT_TENANT_EMAIL=${a.customerEmail || ""}`,
      `CLIENT_OWNER_PHONE=${a.customerPhone || BASE.payment.whatsappInternational}`,
      `CLIENT_PAYMENT_BANK="${BASE.payment.bankName} (${BASE.payment.bankCode})"`,
      `CLIENT_PAYMENT_PHONE=${BASE.payment.phoneFormatted}`,
      `CLIENT_PAYMENT_RIF=${BASE.payment.cedulaFormatted}`,
      `CLIENT_PAYMENT_BENEFICIARY="${BASE.payment.holderName}"`,
      `CLIENT_WHATSAPP_ENABLED=true`,
      `CLIENT_BOT_PORT=3001`,
      `# API Key asignada para standalone-chatbot-api.ts:`,
      `# X-API-Key: ${a.apiKey}`,
      ""
    ].join("\n");

    downloadFile(".env.client-bot", envText, "text/plain");
    showToast("Archivo .env.client-bot descargado listo para desplegar");
  }

  // Descargar PDF semanal desde client-sales-bot.ts enviando X-Panel-Token
  async function downloadWeeklyPdf() {
    const url = joinUrl(state.apiConfig.clientBotBaseUrl, state.apiConfig.clientBotPdfEndpoint || "/api/reports/weekly-pdf");
    try {
      const res = await fetch(url, { headers: buildBotPanelHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      downloadFile(`cierre-semanal-chekea-${new Date().toISOString().slice(0, 10)}.pdf`, blob, "application/pdf");
      showToast("PDF de Cierre Semanal descargado");
    } catch (err) {
      showToast(`Inicia client-sales-bot.ts en ${state.apiConfig.clientBotBaseUrl} para descargar el PDF (${err.message})`);
    }
  }

  // Cargar conversaciones reales desde GET /api/v1/chatbot/conversations
  async function loadApiConversations() {
    const box = document.getElementById("portalConversationsBox");
    if (!box || !state.activeAccess) return;
    box.hidden = false;
    box.textContent = "Consultando conversaciones en standalone-chatbot-api.ts...";

    try {
      const url = joinUrl(state.apiConfig.baseUrl, state.apiConfig.conversationsEndpoint || "/api/v1/chatbot/conversations");
      const res = await fetch(url, { headers: buildAuthHeaders(state.activeAccess.apiKey) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = (json && json.data) || [];
      if (!list.length) {
        box.textContent = "Conexión exitosa: aún no hay conversaciones registradas para este Tenant.";
        return;
      }
      box.innerHTML = list
        .slice(0, 8)
        .map(
          (c) =>
            `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08)"><strong>${escapeHtml(c.customer_name || c.phone)}</strong> · ${escapeHtml(c.title || c.state)} <span style="opacity:.6">(${escapeHtml(c.state)})</span></div>`
        )
        .join("");
    } catch (err) {
      box.textContent = `No se pudo consultar ${state.apiConfig.baseUrl}/api/v1/chatbot/conversations (${err.message}). Verifica que npm run dev:api esté activo y permita CORS.`;
    }
  }

  // ==========================================================================
  // RENDERIZADO DE PLANES Y FUNDADORES
  // ==========================================================================
  function renderPlans() {
    const grid = document.getElementById("plansGrid");
    const rateEl = document.getElementById("displayExchangeRate");
    if (rateEl) rateEl.textContent = `${formatRate(state.exchangeRateBs)} Bs/USD`;
    if (!grid) return;

    grid.innerHTML = BASE.plans
      .map((plan) => {
        const priceUsd = getPlanPriceUsd(plan);
        const bsFormatted = formatBs(priceUsd);
        const cardClass = plan.featured
          ? "plan-card plan-card--featured"
          : plan.id === "gold"
            ? "plan-card plan-card--gold"
            : "plan-card";
        const btnClass = plan.featured || plan.id === "gold" ? "btn--primary" : "btn--secondary";
        const billingSuffix = state.billing === "annual" ? "/ mes (anual)" : "/ mes";

        return `
          <article class="${cardClass}">
            <div>
              <span class="plan-card__badge">${escapeHtml(plan.badge)}</span>
              <h3 class="plan-card__name">Plan ${escapeHtml(plan.name)}</h3>
              <p class="plan-card__tagline">${escapeHtml(plan.tagline)}</p>

              <div class="plan-card__price-box">
                <div class="plan-card__price">
                  <strong>$${priceUsd}</strong>
                  <span>USD ${billingSuffix}</span>
                </div>
                <div class="plan-card__bs">≈ Bs. ${bsFormatted} vía Pago Móvil Mercantil</div>
              </div>

              <div class="plan-card__quota">
                <span><strong>${escapeHtml(plan.quotaRequests)}</strong></span>
                <span>${escapeHtml(plan.rateLimit)}</span>
              </div>

              <ul class="plan-features">
                ${plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
              </ul>
            </div>

            <button type="button" class="btn ${btnClass} btn--full btn--lg" data-open-payment="${plan.id}">
              Pagar y Activar Plan ${escapeHtml(plan.name)}
            </button>
          </article>
        `;
      })
      .join("");
  }

  function renderFounders() {
    const grid = document.getElementById("foundersGrid");
    if (!grid) return;

    grid.innerHTML = BASE.founders
      .map(
        (f) => `
        <article class="founder-card" tabindex="0" role="button" aria-label="Ver perfil de ${escapeHtml(f.name)}" data-open-founder="${f.id}">
          <div class="founder-card__media">
            <img src="${escapeHtml(f.image)}" alt="${escapeHtml(f.name)} — ${escapeHtml(f.role)}" class="founder-card__img" loading="lazy" />
            <span class="founder-card__plus" aria-hidden="true">+</span>
          </div>
          <div class="founder-card__info">
            <span class="founder-card__role">${escapeHtml(f.role)}</span>
            <h3 class="founder-card__name">${escapeHtml(f.name)}</h3>
            <p class="founder-card__short">${escapeHtml(f.shortRole)}</p>
          </div>
        </article>
      `
      )
      .join("");
  }

  // ==========================================================================
  // MODALES
  // ==========================================================================
  function openModal(modalId) {
    closeAllModals();
    const backdrop = document.getElementById(modalId);
    if (!backdrop) return;
    backdrop.classList.add("is-open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeAllModals() {
    document.querySelectorAll(".modal-backdrop.is-open").forEach((m) => {
      m.classList.remove("is-open");
      m.setAttribute("aria-hidden", "true");
    });
    document.body.classList.remove("modal-open");
  }

  function openFounderModal(founderId) {
    const founder = BASE.founders.find((f) => f.id === founderId);
    if (!founder) return;

    document.getElementById("founderModalImg").src = founder.image;
    document.getElementById("founderModalImg").alt = `${founder.name} — ${founder.role}`;
    document.getElementById("founderModalRole").textContent = founder.role;
    document.getElementById("founderModalName").textContent = founder.name;
    document.getElementById("founderModalSummary").textContent = founder.summary;
    document.getElementById("founderModalBio").textContent = founder.bio;
    document.getElementById("founderModalTags").innerHTML = founder.highlights
      .map((tag) => `<span class="founder-tag">${escapeHtml(tag)}</span>`)
      .join("");

    const waBtn = document.getElementById("founderWhatsappBtn");
    waBtn.href = buildWhatsAppUrl(founder.whatsappText);
    waBtn.textContent = `Contactar por WhatsApp (${BASE.payment.phoneFormatted})`;

    openModal("founderModal");
  }

  function openPaymentModal(planId) {
    const select = document.getElementById("payPlanSelect");
    const stepForm = document.getElementById("paymentStepForm");
    const stepSuccess = document.getElementById("paymentStepSuccess");

    if (stepForm && stepSuccess) {
      stepForm.hidden = false;
      stepSuccess.hidden = true;
    }
    if (select && planId) select.value = planId;

    const payDateInput = document.getElementById("payDate");
    if (payDateInput && !payDateInput.value) {
      payDateInput.value = new Date().toISOString().split("T")[0];
    }

    updateCheckoutSummary();
    openModal("paymentModal");
  }

  function updateCheckoutSummary() {
    const select = document.getElementById("payPlanSelect");
    const plan = getPlanById(select ? select.value : "pro");
    const priceUsd = getPlanPriceUsd(plan);
    const summaryEl = document.getElementById("pmAmountSummary");
    const copyBsBtn = document.getElementById("copyBsAmountBtn");

    if (summaryEl) summaryEl.textContent = `$${priceUsd} USD · Bs. ${formatBs(priceUsd)}`;
    if (copyBsBtn) copyBsBtn.dataset.bsPlain = (priceUsd * state.exchangeRateBs).toFixed(2);
  }

  // ==========================================================================
  // PROCESAMIENTO DE PAGO MÓVIL -> PROVISIÓN REAL EN standalone-chatbot-api.ts
  // Y DESBLOQUEO INMEDIATO DEL BOT + API
  // ==========================================================================
  async function handlePaymentSubmit(event) {
    event.preventDefault();

    const planId = document.getElementById("payPlanSelect").value;
    const businessType = document.getElementById("payBusinessType").value || "RETAIL";
    const customerName = document.getElementById("payCustomerName").value.trim();
    const customerEmail = document.getElementById("payCustomerEmail").value.trim();
    const originBank = document.getElementById("payOriginBank").value;
    const customerPhone = document.getElementById("payCustomerPhone").value.trim();
    const reference = document.getElementById("payReference").value.trim();
    const paymentDate = document.getElementById("payDate").value;

    const plan = getPlanById(planId);
    const planEnum = plan.apiPlanEnum || plan.id.toUpperCase();
    const amountUsd = getPlanPriceUsd(plan);
    const amountBs = Number((amountUsd * state.exchangeRateBs).toFixed(2));
    const submitBtn = document.getElementById("confirmPaymentBtn");

    submitBtn.disabled = true;
    submitBtn.textContent = "Conectando con standalone-chatbot-api y creando API Key...";

    let apiKey = generateFallbackApiKey(plan.id);
    let tenantId = `tenant_${Date.now().toString(36)}`;
    let provisionSource = "local_fallback";
    let webhookNote =
      "Emitida en modo respaldo local. Inicia standalone-chatbot-api.ts (npm run dev:api) y configura tu API Key Maestra en API Studio para emitir llaves directamente en Prisma.";

    // Payload exacto esperado por CreateClientApiKeySchema en standalone-chatbot-api.ts
    const provisionUrl = joinUrl(
      state.apiConfig.baseUrl,
      state.apiConfig.provisionEndpoint || "/api/v1/chatbot/api-keys/generate"
    );

    const apiKeyPayload = {
      name: customerName,
      email: customerEmail,
      plan: planEnum,
      business_type: businessType,
      whatsapp_phone: customerPhone.replace(/\D/g, "") || undefined,
      rotate_secret: false
    };

    if (provisionUrl && state.apiConfig.autoGenerateKeyOnPayment !== false) {
      try {
        const headers = buildAuthHeaders(state.apiConfig.masterApiToken);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(provisionUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(apiKeyPayload),
          signal: controller.signal
        });
        clearTimeout(timeout);

        const bodyJson = await res.json().catch(() => ({}));

        if (res.ok && bodyJson && bodyJson.data && bodyJson.data.apiKey) {
          apiKey = bodyJson.data.apiKey;
          tenantId = bodyJson.data.tenantId || tenantId;
          provisionSource = "standalone_api_live";
          webhookNote = `✅ Tenant (${tenantId}) y API Key real generados en tu servidor (${provisionUrl}).`;
        } else if (state.apiConfig.mode === "remote_only") {
          const errMsg =
            (bodyJson && bodyJson.error && bodyJson.error.message) ||
            `HTTP ${res.status} desde ${provisionUrl}`;
          throw new Error(errMsg);
        } else {
          const errMsg = (bodyJson && bodyJson.error && bodyJson.error.message) || `HTTP ${res.status}`;
          webhookNote = `Tu API respondió (${errMsg}); se activó llave de respaldo local para desbloquear el portal.`;
        }
      } catch (err) {
        if (state.apiConfig.mode === "remote_only") {
          submitBtn.disabled = false;
          submitBtn.textContent = "Confirmar Pago y Desbloquear Bot + API";
          showToast(`Error en API de provisión: ${err.message}`);
          return;
        }
        webhookNote = `Servidor ${state.apiConfig.baseUrl} no accesible ahora (${err.message}). Se emitió acceso local inmediato.`;
      }
    }

    const record = {
      id: `tx_${Date.now()}`,
      tenantId,
      customerName,
      customerEmail,
      customerPhone,
      businessType,
      originBank,
      reference,
      paymentDate,
      planId: plan.id,
      planEnum,
      planName: plan.name,
      amountUsd,
      amountBs,
      apiKey,
      provisionSource,
      status: "active",
      createdAt: new Date().toLocaleString("es-VE")
    };

    state.generatedKeys.unshift(record);

    // DESBLOQUEO AUTOMÁTICO DEL PORTAL DEL BOT Y LA API AL CONFIRMAR EL PAGO
    unlockClientAccess({
      tenantId,
      customerName,
      customerEmail,
      customerPhone,
      businessType,
      planId: plan.id,
      planEnum,
      planName: plan.name,
      apiKey,
      reference,
      unlockedAt: new Date().toISOString()
    });

    renderKeysTable();

    // Pantalla de éxito con acceso inmediato
    document.getElementById("paymentStepForm").hidden = true;
    document.getElementById("paymentStepSuccess").hidden = false;
    document.getElementById("successPlanDesc").textContent =
      `Plan ${plan.name} (${businessType}) activado para ${customerName}. Ya tienes acceso completo al Bot Comercial y tu API.`;
    document.getElementById("freshApiKeyValue").textContent = apiKey;
    document.getElementById("freshWebhookStatus").textContent = webhookNote;

    const receiptWaMessage =
      `Hola equipo Chekea, acabo de pagar y activar mi acceso al Bot + API (Mercantil 0424-6003606).\n` +
      `• Negocio/Cliente: ${customerName}\n` +
      `• Rubro: ${businessType}\n` +
      `• Plan: ${plan.name} ($${amountUsd} USD / Bs. ${formatBs(amountUsd)})\n` +
      `• Banco emisor: ${originBank}\n` +
      `• Referencia: ${reference}\n` +
      `• Tenant ID: ${tenantId}\n` +
      `• API Key: ${apiKey}`;

    document.getElementById("sendReceiptWhatsappBtn").href = buildWhatsAppUrl(receiptWaMessage);

    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar Pago y Desbloquear Bot + API";
    document.getElementById("paymentCheckoutForm").reset();
    showToast(`¡Pago confirmado! Bot y API desbloqueados (${plan.name})`);
  }

  // ==========================================================================
  // API STUDIO
  // ==========================================================================
  function hydrateApiConfigForm() {
    document.getElementById("cfgBaseUrl").value = state.apiConfig.baseUrl || "http://localhost:3000";
    document.getElementById("cfgClientBotUrl").value = state.apiConfig.clientBotBaseUrl || "http://localhost:3001";
    document.getElementById("cfgChatEndpoint").value = state.apiConfig.chatEndpoint || "/api/v1/chatbot/message";
    document.getElementById("cfgProvisionEndpoint").value =
      state.apiConfig.provisionEndpoint || "/api/v1/chatbot/api-keys/generate";
    document.getElementById("cfgMode").value = state.apiConfig.mode || "local_plus_webhook";
    document.getElementById("cfgAuthHeader").value = state.apiConfig.authHeaderName || "X-API-Key";
    document.getElementById("cfgMasterToken").value = state.apiConfig.masterApiToken || "";
    document.getElementById("cfgBotPanelToken").value = state.apiConfig.clientBotPanelToken || "";
    document.getElementById("cfgKeyPrefix").value = state.apiConfig.customKeyPrefix || "sk_live_";
    document.getElementById("cfgExchangeRate").value = state.exchangeRateBs;
    document.getElementById("cfgAutoGenerate").checked = state.apiConfig.autoGenerateKeyOnPayment !== false;

    updateChatStatusBadge();
    renderUploadedSpec();
    renderKeysTable();
    renderCodeSnippets();
  }

  function updateChatStatusBadge() {
    const badge = document.getElementById("chatConnectionBadge");
    if (!badge) return;
    if (state.activeAccess && state.activeAccess.apiKey) {
      const engineSelect = document.getElementById("chatEngineSelect");
      const engine = engineSelect ? engineSelect.value : "standalone_api";
      const label =
        engine === "client_bot"
          ? `Bot Comercial activo (${state.apiConfig.clientBotBaseUrl})`
          : `API SaaS activa (${state.apiConfig.baseUrl}) · Plan ${state.activeAccess.planEnum}`;
      badge.innerHTML = `<span class="status-dot status-dot--green"></span>${escapeHtml(label)}`;
    } else {
      badge.innerHTML = `<span class="status-dot status-dot--green"></span>Vista previa (Paga para activar Bot + API)`;
    }
  }

  function renderUploadedSpec() {
    const spec = state.apiConfig.uploadedSpec || BASE.apiStudio.uploadedSpec;
    const titleEl = document.getElementById("loadedSpecTitle");
    const fileEl = document.getElementById("loadedSpecFilename");
    const descEl = document.getElementById("loadedSpecDesc");
    const listEl = document.getElementById("loadedSpecEndpoints");

    if (titleEl) titleEl.textContent = (spec.info && spec.info.title) || "API Personalizada";
    if (fileEl) fileEl.textContent = state.apiConfig.uploadedSpecName || "chekea-backend-v1.json";
    if (descEl) descEl.textContent = (spec.info && spec.info.description) || "Especificación cargada desde JSON.";

    if (!listEl) return;
    const paths = spec.paths || {};
    const rows = [];

    Object.entries(paths).forEach(([pathKey, methodsObj]) => {
      if (methodsObj && typeof methodsObj === "object") {
        Object.entries(methodsObj).forEach(([method, meta]) => {
          const upper = method.toUpperCase();
          const badgeClass = upper === "GET" ? "method--get" : "method--post";
          const summary = (meta && (meta.summary || meta.description)) || "Endpoint configurado";
          rows.push(`
            <div class="spec-endpoint-row">
              <div class="spec-endpoint-row__left">
                <span class="method ${badgeClass}">${escapeHtml(upper)}</span>
                <code>${escapeHtml(pathKey)}</code>
              </div>
              <span class="spec-endpoint-row__summary">${escapeHtml(summary)}</span>
            </div>
          `);
        });
      }
    });

    listEl.innerHTML = rows.length
      ? rows.join("")
      : `<p class="spec-preview__desc">Archivo JSON cargado sin objeto <code>paths</code>.</p>`;
  }

  function handleSpecFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        state.apiConfig.uploadedSpec = parsed;
        state.apiConfig.uploadedSpecName = file.name;
        if (Array.isArray(parsed.servers) && parsed.servers[0] && parsed.servers[0].url) {
          state.apiConfig.baseUrl = parsed.servers[0].url;
          document.getElementById("cfgBaseUrl").value = parsed.servers[0].url;
        }
        saveState();
        renderUploadedSpec();
        renderCodeSnippets();
        updateChatStatusBadge();
        showToast(`Especificación "${file.name}" cargada correctamente`);
      } catch {
        showToast("El archivo debe ser un JSON válido.");
      }
    };
    reader.readAsText(file);
  }

  function renderKeysTable() {
    const tbody = document.getElementById("generatedKeysBody");
    const counter = document.getElementById("keysCountBadge");
    if (counter) counter.textContent = String(state.generatedKeys.length);
    if (!tbody) return;

    if (!state.generatedKeys.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty-table">
            Aún no hay API Keys generadas. Completa un pago en la pasarela o pulsa <strong>"+ Generar Key de prueba"</strong>.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.generatedKeys
      .map((item) => {
        const masked = `${item.apiKey.slice(0, 16)}••••${item.apiKey.slice(-4)}`;
        const statusClass = item.status === "active" ? "status-pill--active" : "status-pill--revoked";
        const statusLabel = item.status === "active" ? "Activa" : "Revocada";

        return `
          <tr>
            <td>
              <strong>${escapeHtml(item.customerName)}</strong><br />
              <small style="color:#a1a1a6">${escapeHtml(item.customerEmail)} · ${escapeHtml(item.businessType || "RETAIL")}</small>
            </td>
            <td>Plan ${escapeHtml(item.planName)}</td>
            <td>#${escapeHtml(item.reference)}</td>
            <td><code class="key-code-pill" title="${escapeHtml(item.apiKey)}">${escapeHtml(masked)}</code></td>
            <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
            <td>
              <div class="table-actions">
                <button type="button" class="btn btn--ghost btn--xs" data-key-use="${escapeHtml(item.id)}">Usar</button>
                <button type="button" class="btn btn--ghost btn--xs" data-key-copy="${escapeHtml(item.apiKey)}">Copiar</button>
                <button type="button" class="btn btn--ghost btn--xs" data-key-toggle="${escapeHtml(item.id)}">
                  ${item.status === "active" ? "Revocar" : "Activar"}
                </button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderCodeSnippets() {
    const endpoint = joinUrl(state.apiConfig.baseUrl || "http://localhost:3000", state.apiConfig.chatEndpoint || "/api/v1/chatbot/message");
    const sampleKey =
      (state.activeAccess && state.activeAccess.apiKey) ||
      state.lastGeneratedKey ||
      (state.generatedKeys[0] && state.generatedKeys[0].apiKey) ||
      "sk_live_tu_api_key_generada";
    const customerName = (state.activeAccess && state.activeAccess.customerName) || "Cliente Web";
    const customerPhone = (state.activeAccess && state.activeAccess.customerPhone) || "584246003606";

    const curlEl = document.getElementById("curlSnippet");
    const jsEl = document.getElementById("jsSnippet");

    if (curlEl) {
      curlEl.textContent =
`# Enviar mensaje a standalone-chatbot-api.ts
curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${sampleKey}" \\
  -d '{
    "message": "Hola, quiero ver el catálogo disponible",
    "customer_phone": "${customerPhone}",
    "customer_name": "${customerName}"
  }'`;
    }

    if (jsEl) {
      jsEl.textContent =
`// Consumir Chatbot API (standalone-chatbot-api.ts)
const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${sampleKey}"
  },
  body: JSON.stringify({
    message: "Hola, ¿tienen disponibilidad?",
    customer_phone: "${customerPhone}",
    customer_name: "${customerName}"
  })
});

const { data } = await res.json();
console.log(data.response, data.conversation_id);`;
    }
  }

  function exportConfigJsFile() {
    const updatedConfig = structuredCloneSafe(BASE);
    updatedConfig.payment.exchangeRateBs = state.exchangeRateBs;
    updatedConfig.apiStudio = state.apiConfig;

    const content =
      `// Archivo generado desde Chekea API Studio (${new Date().toLocaleString("es-VE")})\n` +
      `// Reemplaza tu archivo config.js para persistir tus URLs de standalone-chatbot-api y client-sales-bot.\n\n` +
      `window.CHEKEA_CONFIG = ${JSON.stringify(updatedConfig, null, 2)};\n`;

    downloadFile("config.js", content, "application/javascript");
    showToast("Descargado config.js con tus rutas y tokens actualizados");
  }

  // ==========================================================================
  // CHATBOT INTERACTIVO CONECTADO A standalone-chatbot-api.ts Y client-sales-bot.ts
  // ==========================================================================
  function appendChatMessage(containerId, text, sender, metaExtra) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement("div");
    div.className = `chat-msg chat-msg--${sender}`;
    const time = new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
    let rateHtml = "";

    if (sender === "bot" && metaExtra && metaExtra.queryId && state.activeAccess) {
      rateHtml = `
        <div class="chat-rate-row">
          <button type="button" class="chat-rate-btn" data-rate-query="${escapeHtml(metaExtra.queryId)}" data-rate-val="true">👍 Útil</button>
          <button type="button" class="chat-rate-btn" data-rate-query="${escapeHtml(metaExtra.queryId)}" data-rate-val="false">👎 Mejorar</button>
        </div>
      `;
    }

    const label = sender === "user" ? "Tú" : (metaExtra && metaExtra.sourceLabel) || "Chekea IA";
    div.innerHTML = `${escapeHtml(text).replace(/\n/g, "<br />")}${rateHtml}<span class="chat-msg__meta">${escapeHtml(label)} · ${time}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  async function rateBotQuery(queryId, helpful, btn) {
    if (!state.activeAccess) return;
    try {
      const url = joinUrl(state.apiConfig.baseUrl, `${state.apiConfig.rateEndpoint || "/api/v1/chatbot/rate"}/${encodeURIComponent(queryId)}`);
      const res = await fetch(url, {
        method: "POST",
        headers: buildAuthHeaders(state.activeAccess.apiKey),
        body: JSON.stringify({ helpful })
      });
      if (res.ok) {
        btn.classList.add("is-rated");
        showToast("Gracias por calificar la respuesta del Chatbot");
      }
    } catch {
      showToast("No se pudo enviar la calificación al servidor");
    }
  }

  async function generateBotReply(userMessage, attachment) {
    // 1. Si el cliente YA PAGÓ / DESBLOQUEÓ ACCESO -> Conectar directo a su backend seleccionado
    if (state.activeAccess && state.activeAccess.apiKey) {
      const engineSelect = document.getElementById("chatEngineSelect");
      const engineMode = engineSelect ? engineSelect.value : "standalone_api";
      const customerPhone = (state.activeAccess.customerPhone || "584246003606").replace(/\D/g, "") || "api-client";
      const customerName = state.activeAccess.customerName || "Cliente";

      if (engineMode === "client_bot") {
        // Conexión directa a client-sales-bot.ts -> POST /api/chat
        const botChatUrl = joinUrl(state.apiConfig.clientBotBaseUrl, state.apiConfig.clientBotChatEndpoint || "/api/chat");
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(botChatUrl, {
            method: "POST",
            headers: buildBotPanelHeaders(),
            body: JSON.stringify({
              phone: customerPhone,
              name: customerName,
              message: userMessage,
              imageBase64: attachment ? attachment.base64 : undefined,
              mimeType: attachment ? attachment.mimeType : undefined
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success && json.data && json.data.text) {
            let replyText = json.data.text;
            if (json.data.pdfAttachment && json.data.pdfAttachment.filename) {
              replyText += `\n\n📄 Reporte generado: ${json.data.pdfAttachment.filename} (descárgalo arriba en "PDF Cierre Semanal").`;
            }
            return { text: replyText, sourceLabel: `Bot Comercial (${json.data.plan})` };
          }
          if (json.paused) {
            return { text: "El Bot Comercial está actualmente apagado. Enciéndelo en el panel superior.", sourceLabel: "Bot Comercial" };
          }
          throw new Error((json && json.error) || `HTTP ${res.status}`);
        } catch (err) {
          return {
            text: `⚠️ No pude conectar con client-sales-bot.ts en ${botChatUrl} (${err.message}).\nVerifica que el bot esté corriendo (npm run dev:client-bot) o cambia el selector superior a "API SaaS (:3000)".`,
            sourceLabel: "Bot Comercial (Offline)"
          };
        }
      } else {
        // Conexión directa a standalone-chatbot-api.ts -> POST /api/v1/chatbot/message
        const apiChatUrl = joinUrl(state.apiConfig.baseUrl, state.apiConfig.chatEndpoint || "/api/v1/chatbot/message");
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 14000);
          const res = await fetch(apiChatUrl, {
            method: "POST",
            headers: buildAuthHeaders(state.activeAccess.apiKey),
            body: JSON.stringify({
              message: userMessage,
              conversation_id: state.conversationId,
              customer_phone: customerPhone,
              customer_name: customerName,
              recipe_image_base64: attachment ? attachment.base64 : null,
              recipe_mime_type: attachment ? attachment.mimeType : "image/jpeg"
            }),
            signal: controller.signal
          });
          clearTimeout(timer);

          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success && json.data) {
            if (json.data.conversation_id) state.conversationId = json.data.conversation_id;
            return {
              text: json.data.response || "Respuesta recibida sin texto.",
              queryId: json.data.query_id,
              sourceLabel: `API SaaS (${json.data.state || "OK"})`
            };
          }
          const errMsg = (json && json.error && json.error.message) || `HTTP ${res.status}`;
          throw new Error(errMsg);
        } catch (err) {
          return {
            text: `⚠️ Acceso activo con tu llave (${state.activeAccess.apiKey.slice(0, 14)}...), pero standalone-chatbot-api.ts no respondió en ${apiChatUrl} (${err.message}).\nEnciende tu servidor con "npm run dev:api" o ajusta la URL en API Studio.`,
            sourceLabel: "API SaaS (Offline)"
          };
        }
      }
    }

    // 2. MODO PRE-VENTA (antes de pagar: responde dudas comerciales e invita a pagar para desbloquear el bot)
    const q = userMessage.toLowerCase();

    if (q.includes("pago") || q.includes("mercantil") || q.includes("banco") || q.includes("movil") || q.includes("móvil") || q.includes("bs")) {
      return {
        text:
          `Aceptamos Pago Móvil Venezuela a través de ${BASE.payment.bankName} (${BASE.payment.bankCode}):\n` +
          `• Cédula: ${BASE.payment.cedulaFormatted}\n` +
          `• Teléfono: ${BASE.payment.phoneFormatted}\n` +
          `• Titular: ${BASE.payment.holderName}\n` +
          `Al registrar tu referencia en "Contratar", desbloqueas al instante el Bot Comercial y tu API Key.`
      };
    }

    if (q.includes("plan") || q.includes("precio") || q.includes("estandar") || q.includes("estándar") || q.includes("pro") || q.includes("gold")) {
      const lines = BASE.plans.map(
        (p) => `• Plan ${p.name}: $${getPlanPriceUsd(p)} USD/mes (≈ Bs. ${formatBs(getPlanPriceUsd(p))}) — ${p.quotaRequests}.`
      );
      return {
        text: `Nuestros planes con acceso al Bot + API:\n${lines.join("\n")}\nHaz clic en "Pagar y Desbloquear" para activar el tuyo.`
      };
    }

    if (q.includes("fundador") || q.includes("jose") || q.includes("josé") || q.includes("fidel") || q.includes("jesus") || q.includes("jesús")) {
      return {
        text:
          `Fundadores de Chekea:\n` +
          `• Fidel Pereira — Fundador\n` +
          `• Jesús Romero — CEO\n` +
          `• José Davalillo — Ingeniero y Desarrollador de Software\n` +
          `Haz clic en cualquiera de sus tarjetas abajo para ver su perfil y escribirnos al WhatsApp ${BASE.payment.phoneFormatted}.`
      };
    }

    return {
      text:
        `🔒 Para conversar directamente con el Bot de Ventas (catálogo en vivo, pedidos, lectura de récipes y Cierre Semanal PDF) y usar tu API Key, primero activa un plan en "Pagar y Desbloquear" o ingresa tu llave en "Ya tengo mi API Key".`
    };
  }

  async function sendChat(text, sourceContainer) {
    const clean = text.trim();
    const attachment = state.pendingAttachment;
    if (!clean && !attachment) return;

    const displayUserText = attachment ? `${clean || "[Imagen adjunta]"} 📎 (${attachment.filename})` : clean;
    appendChatMessage("embeddedChatMessages", displayUserText, "user");
    appendChatMessage("floatingChatMessages", displayUserText, "user");
    clearChatAttachment();

    const reply = await generateBotReply(clean, attachment);
    appendChatMessage("embeddedChatMessages", reply.text, "bot", reply);
    appendChatMessage("floatingChatMessages", reply.text, "bot", reply);

    if (sourceContainer === "floating") {
      const drawer = document.getElementById("floatingChatDrawer");
      if (drawer) drawer.classList.add("is-open");
    }
  }

  function clearChatAttachment() {
    state.pendingAttachment = null;
    const bar = document.getElementById("chatAttachmentBar");
    const input = document.getElementById("chatImageInput");
    if (bar) bar.hidden = true;
    if (input) input.value = "";
  }

  function initChatWelcome() {
    const welcome = state.activeAccess
      ? `✅ ¡Hola ${state.activeAccess.customerName}! Tu acceso (Plan ${state.activeAccess.planEnum}) está activo. Escribe un mensaje o adjunta una foto para conversar con tu API SaaS (:3000) o Bot Comercial (:3001).`
      : `¡Bienvenido a Chekea! Estás en modo consulta comercial. Paga tu plan Estándar, Pro o Gold (o ingresa tu API Key) para desbloquear el acceso completo al Bot y la API.`;
    document.getElementById("embeddedChatMessages").innerHTML = "";
    document.getElementById("floatingChatMessages").innerHTML = "";
    appendChatMessage("embeddedChatMessages", welcome, "bot");
    appendChatMessage("floatingChatMessages", welcome, "bot");
  }

  // ==========================================================================
  // EVENTOS Y ANIMACIONES
  // ==========================================================================
  function initScrollReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    items.forEach((el) => observer.observe(el));
  }

  function bindEvents() {
    // Menú móvil
    const navToggle = document.getElementById("navToggle");
    const mobileMenu = document.getElementById("mobileMenu");
    if (navToggle && mobileMenu) {
      navToggle.addEventListener("click", () => {
        const open = mobileMenu.classList.toggle("is-open");
        navToggle.classList.toggle("is-open", open);
        navToggle.setAttribute("aria-expanded", String(open));
        mobileMenu.setAttribute("aria-hidden", String(!open));
      });
      mobileMenu.querySelectorAll("a, button").forEach((el) => {
        el.addEventListener("click", () => {
          mobileMenu.classList.remove("is-open");
          navToggle.classList.remove("is-open");
          navToggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Carrusel
    const track = document.getElementById("showcaseTrack");
    onId("carouselPrev", "click", () => {
      if (track) track.scrollBy({ left: -400, behavior: "smooth" });
    });
    onId("carouselNext", "click", () => {
      if (track) track.scrollBy({ left: 400, behavior: "smooth" });
    });

    // Selector Mensual / Anual
    document.querySelectorAll("[data-billing]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.billing = btn.dataset.billing;
        document.querySelectorAll("[data-billing]").forEach((b) => b.classList.toggle("is-active", b === btn));
        renderPlans();
        updateCheckoutSummary();
      });
    });

    // Botones de acceso existente (API Key)
    const handleOpenUnlock = () => {
      if (state.activeAccess) {
        const sec = document.getElementById("chatbot");
        if (sec) sec.scrollIntoView({ behavior: "smooth" });
      } else {
        openModal("unlockAccessModal");
      }
    };
    onId("navAccessBtn", "click", handleOpenUnlock);
    onId("mobileAccessBtn", "click", handleOpenUnlock);
    onId("openUnlockModalBtn", "click", () => openModal("unlockAccessModal"));

    onId("unlockAccessForm", "submit", (e) => {
      e.preventDefault();
      const apiKey = document.getElementById("unlockApiKeyInput").value.trim();
      const customerName = document.getElementById("unlockNameInput").value.trim();
      const planEnum = document.getElementById("unlockPlanInput").value || "PRO";
      if (!apiKey) return;

      unlockClientAccess({
        tenantId: "manual-key",
        customerName,
        customerEmail: "",
        customerPhone: BASE.payment.phoneRaw,
        businessType: "RETAIL",
        planId: planEnum.toLowerCase(),
        planEnum,
        planName: planEnum,
        apiKey,
        unlockedAt: new Date().toISOString()
      });
      closeAllModals();
      initChatWelcome();
      showToast("¡Acceso desbloqueado con tu API Key!");
      const sec = document.getElementById("chatbot");
      if (sec) sec.scrollIntoView({ behavior: "smooth" });
    });

    onId("logoutAccessBtn", "click", () => {
      state.activeAccess = null;
      state.conversationId = null;
      saveState();
      renderAccessPortal();
      initChatWelcome();
      showToast("Sesión de acceso cerrada");
    });

    // Acciones dentro del Portal Desbloqueado
    onId("portalCopyKeyBtn", "click", () => {
      if (state.activeAccess) copyToClipboard(state.activeAccess.apiKey, "X-API-Key copiada");
    });
    onId("downloadClientEnvBtn", "click", downloadClientEnvTemplate);
    onId("loadConversationsBtn", "click", loadApiConversations);
    onId("refreshBotStateBtn", "click", () => syncClientBotState(false));
    onId("downloadWeeklyPdfBtn", "click", downloadWeeklyPdf);

    onId("toggleClientBotBtn", "click", async () => {
      const url = joinUrl(state.apiConfig.clientBotBaseUrl, state.apiConfig.clientBotToggleEndpoint || "/api/toggle");
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: buildBotPanelHeaders(),
          body: "{}"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        showToast(json.botActive ? "Bot Comercial ENCENDIDO" : "Bot Comercial PAUSADO");
        syncClientBotState(true);
      } catch (err) {
        showToast(`No se pudo cambiar estado del Bot (${err.message})`);
      }
    });

    onId("chatEngineSelect", "change", () => {
      updateChatStatusBadge();
      showToast(
        document.getElementById("chatEngineSelect").value === "client_bot"
          ? "Chat dirigido a client-sales-bot.ts (:3001)"
          : "Chat dirigido a standalone-chatbot-api.ts (:3000)"
      );
    });

    // Adjuntar imagen Base64 (récipe / comprobante) al chat
    const chatImgInput = document.getElementById("chatImageInput");
    onId("chatAttachImageBtn", "click", () => {
      if (!state.activeAccess) {
        showToast("Paga un plan o ingresa tu API Key para enviar imágenes al Bot");
        return;
      }
      if (chatImgInput) chatImgInput.click();
    });
    if (chatImgInput) {
      chatImgInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || "");
          const parts = result.split(",");
          state.pendingAttachment = {
            base64: parts[1] || "",
            mimeType: file.type || "image/jpeg",
            filename: file.name
          };
          document.getElementById("chatAttachmentName").textContent = `📎 ${file.name}`;
          document.getElementById("chatAttachmentBar").hidden = false;
        };
        reader.readAsDataURL(file);
      });
    }
    onId("clearChatAttachmentBtn", "click", clearChatAttachment);

    // Delegación global de clics
    document.addEventListener("click", (e) => {
      const openPaymentBtn = e.target.closest("[data-open-payment]");
      if (openPaymentBtn) {
        openPaymentModal(openPaymentBtn.dataset.openPayment);
        return;
      }

      const openFounderBtn = e.target.closest("[data-open-founder]");
      if (openFounderBtn) {
        e.preventDefault();
        openFounderModal(openFounderBtn.dataset.openFounder);
        return;
      }

      const openWaBtn = e.target.closest("[data-open-whatsapp]");
      if (openWaBtn) {
        e.preventDefault();
        openModal("whatsappModal");
        return;
      }

      if (e.target.closest("[data-close-modal]") || e.target.classList.contains("modal-backdrop")) {
        closeAllModals();
        return;
      }

      const copyTextBtn = e.target.closest("[data-copy-text]");
      if (copyTextBtn) {
        copyToClipboard(copyTextBtn.dataset.copyText, `Copiado: ${copyTextBtn.dataset.copyText}`);
        return;
      }

      const copyTargetBtn = e.target.closest("[data-copy-target]");
      if (copyTargetBtn) {
        const targetEl = document.getElementById(copyTargetBtn.dataset.copyTarget);
        if (targetEl) copyToClipboard(targetEl.textContent, "Código copiado al portapapeles");
        return;
      }

      const rateBtn = e.target.closest("[data-rate-query]");
      if (rateBtn) {
        rateBotQuery(rateBtn.dataset.rateQuery, rateBtn.dataset.rateVal === "true", rateBtn);
        return;
      }

      const keyUseBtn = e.target.closest("[data-key-use]");
      if (keyUseBtn) {
        const rec = state.generatedKeys.find((k) => k.id === keyUseBtn.dataset.keyUse);
        if (rec) {
          unlockClientAccess({
            tenantId: rec.tenantId,
            customerName: rec.customerName,
            customerEmail: rec.customerEmail,
            customerPhone: rec.customerPhone,
            businessType: rec.businessType || "RETAIL",
            planId: rec.planId,
            planEnum: rec.planEnum || "PRO",
            planName: rec.planName,
            apiKey: rec.apiKey,
            unlockedAt: new Date().toISOString()
          });
          initChatWelcome();
          const sec = document.getElementById("chatbot");
          if (sec) sec.scrollIntoView({ behavior: "smooth" });
          showToast(`Acceso activado para ${rec.customerName}`);
        }
        return;
      }

      const keyCopyBtn = e.target.closest("[data-key-copy]");
      if (keyCopyBtn) {
        copyToClipboard(keyCopyBtn.dataset.keyCopy, "API Key copiada al portapapeles");
        return;
      }

      const keyToggleBtn = e.target.closest("[data-key-toggle]");
      if (keyToggleBtn) {
        const found = state.generatedKeys.find((k) => k.id === keyToggleBtn.dataset.keyToggle);
        if (found) {
          found.status = found.status === "active" ? "revoked" : "active";
          saveState();
          renderKeysTable();
          showToast(found.status === "active" ? "API Key reactivada" : "API Key revocada");
        }
      }
    });

    // Teclado accesible
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAllModals();
        const drawer = document.getElementById("floatingChatDrawer");
        if (drawer) drawer.classList.remove("is-open");
      }
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".founder-card[data-open-founder]")) {
        e.preventDefault();
        openFounderModal(e.target.dataset.openFounder);
      }
    });

    // Pasarela de pago
    onId("payPlanSelect", "change", updateCheckoutSummary);
    onId("paymentCheckoutForm", "submit", handlePaymentSubmit);

    onId("copyBsAmountBtn", "click", (e) => {
      const val = e.currentTarget.dataset.bsPlain || "";
      copyToClipboard(val, `Monto en Bs copiado: ${val}`);
    });

    onId("copyAllPaymentBtn", "click", () => {
      const plan = getPlanById(document.getElementById("payPlanSelect").value);
      const usd = getPlanPriceUsd(plan);
      const summary =
        `Pago Móvil Venezuela - ${BASE.payment.bankName} (${BASE.payment.bankCode})\n` +
        `Cédula: ${BASE.payment.cedulaRaw}\n` +
        `Teléfono: ${BASE.payment.phoneRaw}\n` +
        `Monto: Bs. ${formatBs(usd)} ($${usd} USD - Plan ${plan.name})`;
      copyToClipboard(summary, "Todos los datos de Pago Móvil copiados");
    });

    onId("copyFreshKeyBtn", "click", () => {
      copyToClipboard(document.getElementById("freshApiKeyValue").textContent, "API Key copiada");
    });

    onId("openUnlockedPortalBtn", "click", () => {
      closeAllModals();
      initChatWelcome();
      const sec = document.getElementById("chatbot");
      if (sec) sec.scrollIntoView({ behavior: "smooth" });
    });

    onId("goToStudioKeysBtn", "click", () => {
      closeAllModals();
      activateStudioTab("keys");
      const studio = document.getElementById("api-studio");
      if (studio) studio.scrollIntoView({ behavior: "smooth" });
    });

    // API Studio Tabs
    document.querySelectorAll("[data-studio-tab]").forEach((tab) => {
      tab.addEventListener("click", () => activateStudioTab(tab.dataset.studioTab));
    });

    // Guardar configuración de ambos backends en API Studio
    onId("apiConfigForm", "submit", (e) => {
      e.preventDefault();
      state.apiConfig.baseUrl = document.getElementById("cfgBaseUrl").value.trim();
      state.apiConfig.clientBotBaseUrl = document.getElementById("cfgClientBotUrl").value.trim();
      state.apiConfig.chatEndpoint = document.getElementById("cfgChatEndpoint").value.trim();
      state.apiConfig.provisionEndpoint = document.getElementById("cfgProvisionEndpoint").value.trim();
      state.apiConfig.mode = document.getElementById("cfgMode").value;
      state.apiConfig.authHeaderName = document.getElementById("cfgAuthHeader").value.trim() || "X-API-Key";
      state.apiConfig.masterApiToken = document.getElementById("cfgMasterToken").value.trim();
      state.apiConfig.clientBotPanelToken = document.getElementById("cfgBotPanelToken").value.trim();
      state.apiConfig.customKeyPrefix = document.getElementById("cfgKeyPrefix").value.trim() || "sk_live_";
      state.apiConfig.autoGenerateKeyOnPayment = document.getElementById("cfgAutoGenerate").checked;

      const rateVal = Number(document.getElementById("cfgExchangeRate").value);
      if (Number.isFinite(rateVal) && rateVal > 0) state.exchangeRateBs = rateVal;

      saveState();
      renderPlans();
      updateCheckoutSummary();
      renderAccessPortal();
      renderCodeSnippets();
      showToast("Configuración de Standalone API y Bot Comercial guardada");
    });

    // Probar /health en ambos servidores (standalone-chatbot-api.ts y client-sales-bot.ts)
    onId("testApiConnectionBtn", "click", async () => {
      const output = document.getElementById("apiTestOutput");
      if (!output) return;
      const apiBase = document.getElementById("cfgBaseUrl").value.trim();
      const botBase = document.getElementById("cfgClientBotUrl").value.trim();
      output.hidden = false;
      output.textContent = "Verificando /health en ambos servicios...";

      const checkHealth = async (label, url) => {
        if (!url) return `${label}: (sin URL configurada)`;
        try {
          const res = await fetch(joinUrl(url, "/health"));
          const data = await res.json().catch(() => ({}));
          return `${label} (${url}/health): ✅ HTTP ${res.status} — ${JSON.stringify(data)}`;
        } catch (err) {
          return `${label} (${url}/health): ❌ Sin respuesta (${err.message})`;
        }
      };

      const [r1, r2] = await Promise.all([
        checkHealth("1) Standalone Chatbot API", apiBase),
        checkHealth("2) Client Sales Bot", botBase)
      ]);
      output.textContent = `${r1}\n${r2}`;
    });

    // Subir archivo JSON OpenAPI
    const dropzone = document.getElementById("apiDropzone");
    const fileInput = document.getElementById("apiSpecFileInput");
    onId("browseSpecBtn", "click", () => {
      if (fileInput) fileInput.click();
    });
    if (fileInput) {
      fileInput.addEventListener("change", (e) => handleSpecFile(e.target.files[0]));
    }
    if (dropzone) {
      ["dragenter", "dragover"].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.add("is-dragover");
        });
      });
      ["dragleave", "drop"].forEach((evt) => {
        dropzone.addEventListener(evt, (e) => {
          e.preventDefault();
          dropzone.classList.remove("is-dragover");
        });
      });
      dropzone.addEventListener("drop", (e) => {
        const file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null;
        handleSpecFile(file);
      });
    }

    // Acciones tabla de API Keys
    onId("manualGenerateKeyBtn", "click", () => {
      const apiKey = generateFallbackApiKey("pro");
      const rec = {
        id: `tx_${Date.now()}`,
        tenantId: `tenant_${Date.now().toString(36)}`,
        customerName: "Cliente Demo",
        customerEmail: "demo@chekea.io",
        customerPhone: "584246003606",
        businessType: "RETAIL",
        originBank: "Mercantil (0105)",
        reference: String(Math.floor(100000 + Math.random() * 899999)),
        planId: "pro",
        planEnum: "PRO",
        planName: "Pro",
        amountUsd: getPlanPriceUsd(getPlanById("pro")),
        amountBs: Number((getPlanPriceUsd(getPlanById("pro")) * state.exchangeRateBs).toFixed(2)),
        apiKey,
        status: "active",
        createdAt: new Date().toLocaleString("es-VE")
      };
      state.generatedKeys.unshift(rec);
      state.lastGeneratedKey = apiKey;
      saveState();
      renderKeysTable();
      renderCodeSnippets();
      showToast("API Key de prueba generada — pulsa 'Usar' para probar el portal");
    });

    onId("exportKeysJsonBtn", "click", () => {
      downloadFile("chekea-api-keys.json", JSON.stringify(state.generatedKeys, null, 2), "application/json");
      showToast("Registro de API Keys exportado en JSON");
    });

    onId("exportConfigBtn", "click", exportConfigJsFile);

    // Chatbot embebido y flotante
    onId("embeddedChatForm", "submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("embeddedChatInput");
      sendChat(input.value, "embedded");
      input.value = "";
    });

    onId("floatingChatForm", "submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("floatingChatInput");
      sendChat(input.value, "floating");
      input.value = "";
    });

    document.querySelectorAll(".prompt-chip").forEach((chip) => {
      chip.addEventListener("click", () => sendChat(chip.dataset.prompt, "embedded"));
    });

    onId("clearChatBtn", "click", () => {
      state.conversationId = null;
      initChatWelcome();
    });

    const floatingDrawer = document.getElementById("floatingChatDrawer");
    onId("floatingChatToggle", "click", () => {
      if (!floatingDrawer) return;
      const isOpen = floatingDrawer.classList.toggle("is-open");
      floatingDrawer.setAttribute("aria-hidden", String(!isOpen));
    });
    onId("floatingChatClose", "click", () => {
      if (!floatingDrawer) return;
      floatingDrawer.classList.remove("is-open");
      floatingDrawer.setAttribute("aria-hidden", "true");
    });

    // Modal de WhatsApp
    const waTextarea = document.getElementById("waCustomMessage");
    document.querySelectorAll(".wa-topic").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".wa-topic").forEach((b) => b.classList.toggle("is-active", b === btn));
        if (waTextarea) waTextarea.value = btn.dataset.waMsg;
      });
    });

    onId("whatsappDirectForm", "submit", (e) => {
      e.preventDefault();
      const msg = (waTextarea && waTextarea.value.trim()) || "Hola equipo Chekea, deseo más información.";
      window.open(buildWhatsAppUrl(msg), "_blank", "noopener,noreferrer");
      closeAllModals();
    });
  }

  function activateStudioTab(tabName) {
    document.querySelectorAll("[data-studio-tab]").forEach((t) => {
      const active = t.dataset.studioTab === tabName;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-studio-panel]").forEach((p) => {
      p.classList.toggle("is-active", p.dataset.studioPanel === tabName);
    });
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================
  function init() {
    const yearEl = document.getElementById("footerYear");
    if (yearEl) yearEl.textContent = String(BASE.brand.year || new Date().getFullYear());

    const heroImg = document.getElementById("heroImage");
    const aiImg = document.getElementById("aiArchitectureImage");
    if (heroImg && BASE.media.heroShowcase) heroImg.src = BASE.media.heroShowcase;
    if (aiImg && BASE.media.aiArchitecture) aiImg.src = BASE.media.aiArchitecture;

    renderPlans();
    renderFounders();
    hydrateApiConfigForm();
    renderAccessPortal();
    initChatWelcome();
    bindEvents();
    initScrollReveal();

    if (!sessionStorage.getItem(STORAGE_KEYS.WA_POPUP_SEEN)) {
      setTimeout(() => {
        const anyModalOpen = document.querySelector(".modal-backdrop.is-open");
        if (!anyModalOpen) {
          sessionStorage.setItem(STORAGE_KEYS.WA_POPUP_SEEN, "1");
          showToast("¿Dudas o quieres activar tu plan? Escríbenos por WhatsApp al 0424-6003606");
        }
      }, 4200);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
