/**
 * ============================================================================
 * CKEKEA — LÓGICA MULTIPÁGINA + ASISTENTE REAL MAX (+584166214410)
 * ============================================================================
 * Soporta todas las páginas: index.html, chatbot.html, planes.html,
 * api-studio.html y fundadores.html.
 *
 * Incluye:
 *  - Flujo conversacional completo de Max de Ckekea (de src/modules/bot/bot.ai.ts
 *    y src/modules/bot/bot.service.ts):
 *      1⃣ Planes (Estándar, Pro y Gold)
 *      2⃣ Demo interactiva de venta (Combo Emprendedor -> Cantidad -> Pago Móvil)
 *      3⃣ Seguridad ISO 27001 y ERP (Saint, Profit Plus, A2, Valery, Premium Soft)
 *      4⃣ Diagnóstico rápido de negocio con recomendación de plan + pase a WhatsApp Max
 *  - Conexión real a standalone-chatbot-api.ts (:3000) y client-sales-bot.ts (:3001)
 *  - Pasarela Pago Móvil Mercantil (0105, V-31.091.406, 0424-6003606) que emite
 *    API Key y desbloquea automáticamente el Portal Bot + API.
 */

(function () {
  "use strict";

  const STORAGE_KEYS = {
    API_CONFIG: "ckekea_api_config_v3",
    GENERATED_KEYS: "ckekea_generated_keys_v3",
    EXCHANGE_RATE: "ckekea_exchange_rate_v3",
    ACTIVE_ACCESS: "ckekea_active_client_access_v3",
    WA_POPUP_SEEN: "ckekea_wa_welcome_seen_v3"
  };

  const BASE = window.CHEKEA_CONFIG;
  const currentPage = (document.body.getAttribute("data-page") || "inicio").toLowerCase();

  const DEMO_PRODUCTS = [
    { id: 1, name: "Combo Emprendedor", price: 25.0 },
    { id: 2, name: "Kit Farmacia Express", price: 38.0 },
    { id: 3, name: "Pack Ferretería Pro", price: 45.0 }
  ];

  const state = {
    billing: "monthly",
    exchangeRateBs: loadNumber(STORAGE_KEYS.EXCHANGE_RATE, BASE.payment.exchangeRateBs),
    apiConfig: Object.assign(
      {},
      structuredCloneSafe(BASE.apiStudio),
      loadJson(STORAGE_KEYS.API_CONFIG, {})
    ),
    generatedKeys: loadJson(STORAGE_KEYS.GENERATED_KEYS, []),
    activeAccess: loadJson(STORAGE_KEYS.ACTIVE_ACCESS, null),
    conversationId: null,
    pendingAttachment: null,
    lastGeneratedKey: null,
    selectedWaChannel: BASE.bot.whatsappNumberRaw, // Por defecto: Bot Max (+584166214410)
    // Estado conversacional local fiel a Max (src/modules/bot/bot.service.ts)
    maxSession: {
      step: "MAIN_MENU",
      demoProduct: null,
      demoQty: 1,
      diagnosis: { business: "", volume: "", bottleneck: "" }
    }
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
      // Continúa en memoria si storage no está disponible.
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

  function formatRichBotText(text) {
    return escapeHtml(text)
      .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />");
  }

  function normalizeText(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function formatBs(amountUsd) {
    return new Intl.NumberFormat("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amountUsd * state.exchangeRateBs);
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
      return Math.round(plan.priceUsdMonthly * (1 - BASE.payment.annualDiscountPercent / 100));
    }
    return plan.priceUsdMonthly;
  }

  function buildWhatsAppUrl(message, phoneRaw) {
    const target = (phoneRaw || BASE.bot.whatsappNumberRaw).replace(/\D/g, "");
    return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
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
      headers[headerName] = headerName.toLowerCase() === "authorization" ? `Bearer ${apiKey}` : apiKey;
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
  // RENDERIZADO CONDICIONAL POR PÁGINA
  // ==========================================================================
  function renderSecurityGrid() {
    const grid = document.getElementById("securityGrid");
    if (!grid || !Array.isArray(BASE.security)) return;
    grid.innerHTML = BASE.security
      .map(
        (item) => `
        <article class="security-card reveal is-visible">
          <span class="security-card__code">${escapeHtml(item.code)}</span>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.desc)}</p>
        </article>
      `
      )
      .join("");
  }

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
  // PORTAL DE ACCESO DESBLOQUEADO (chatbot.html + badge en navbar global)
  // ==========================================================================
  function renderAccessPortal() {
    const unlocked = Boolean(state.activeAccess && state.activeAccess.apiKey);
    const hasJwt = Boolean(localStorage.getItem("ckekea_auth_jwt_v1"));
    const navLoginLink = document.getElementById("navLoginLink");
    const mobileLoginLink = document.getElementById("mobileLoginLink");
    if (navLoginLink && hasJwt) {
      navLoginLink.href = "dashboard.html";
      navLoginLink.textContent = "Mi Dashboard ✓";
    }
    if (mobileLoginLink && hasJwt) {
      mobileLoginLink.href = "dashboard.html";
      mobileLoginLink.textContent = "Ir a Mi Dashboard ✓";
    }
    const navAccessBtn = document.getElementById("navAccessBtn");

    if (navAccessBtn) {
      navAccessBtn.textContent = unlocked
        ? `Plan ${state.activeAccess.clientBotPlan || state.activeAccess.planEnum || "Activo"} ✓`
        : "Ya tengo API Key";
    }

    const pill = document.getElementById("accessStatusPill");
    const meta = document.getElementById("accessStatusMeta");
    const primaryCta = document.getElementById("accessPrimaryCta");
    const openUnlockBtn = document.getElementById("openUnlockModalBtn");
    const logoutBtn = document.getElementById("logoutAccessBtn");
    const portal = document.getElementById("unlockedPortal");
    const lockBanner = document.getElementById("chatLockBanner");

    if (!pill) return; // No estamos en chatbot.html

    const svgLock = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
    const svgCheck = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    if (unlocked) {
      const a = state.activeAccess;
      const planLabel = a.clientBotPlan || a.planName || a.planEnum || "PRO";
      pill.className = "access-pill access-pill--unlocked";
      pill.innerHTML = `${svgCheck} Acceso Activo — Plan ${escapeHtml(planLabel)} Desbloqueado`;
      if (meta) {
        meta.innerHTML = `Sesión activa para <strong>${escapeHtml(a.customerName)}</strong> (${escapeHtml(a.businessType || "RETAIL")}). Puedes usar el motor web de Max, tu API SaaS (:3000) y tu Bot Comercial (:3001).`;
      }
      if (primaryCta) primaryCta.hidden = true;
      if (openUnlockBtn) openUnlockBtn.hidden = true;
      if (logoutBtn) logoutBtn.hidden = false;
      if (portal) portal.hidden = false;
      if (lockBanner) lockBanner.hidden = true;

      const chatUrl = joinUrl(state.apiConfig.baseUrl, state.apiConfig.chatEndpoint || "/api/v1/chatbot/message");
      const stockUrl = joinUrl(state.apiConfig.baseUrl, state.apiConfig.stockSyncEndpoint || "/api/v1/stock/import");
      const botQrUrl = joinUrl(state.apiConfig.clientBotBaseUrl, "/qr");

      document.getElementById("portalClientTitle").textContent = `${a.customerName} — API Activa`;
      document.getElementById("portalPlanBadge").textContent = `PLAN ${planLabel}`;
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
      pill.className = "access-pill access-pill--locked";
      pill.innerHTML = `${svgLock} Portal API/Bot Bloqueado — Modo Asesor Max Activo`;
      if (meta) {
        meta.innerHTML = `Puedes conversar ahora mismo con <strong>Max</strong> en el chat de abajo. Paga un plan para desbloquear tu <code>X-API-Key</code> real, el QR WhatsApp y tu Cierre Semanal PDF.`;
      }
      if (primaryCta) primaryCta.hidden = false;
      if (openUnlockBtn) openUnlockBtn.hidden = false;
      if (logoutBtn) logoutBtn.hidden = true;
      if (portal) portal.hidden = true;
      if (lockBanner) lockBanner.hidden = false;
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

  async function syncClientBotState(silent) {
    const botBase = state.apiConfig.clientBotBaseUrl;
    const statusPill = document.getElementById("botLiveStatusPill");
    const qrImg = document.getElementById("botQrImg");
    const qrPlaceholder = document.getElementById("botQrPlaceholder");
    const titleEl = document.getElementById("botServiceTitle");
    const descEl = document.getElementById("botLiveDesc");

    if (!botBase || !statusPill) return;
    if (!silent) statusPill.textContent = "Conectando...";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(joinUrl(botBase, state.apiConfig.clientBotStateEndpoint || "/api/state"), {
        headers: buildBotPanelHeaders(),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("Respuesta inválida");

      const d = json.data;
      if (titleEl) titleEl.textContent = `${d.botName} — ${d.businessName} (Plan ${d.plan})`;
      statusPill.className = `status-pill ${d.botActive ? "status-pill--active" : "status-pill--revoked"}`;
      statusPill.textContent = `${d.botActive ? "Bot ON" : "Bot OFF"} · WA: ${d.waStatus}`;
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
        qrPlaceholder.innerHTML = `<strong>WhatsApp Conectado</strong><span>El bot está atendiendo clientes en vivo.</span>`;
      } else {
        qrImg.hidden = true;
        qrPlaceholder.hidden = false;
        qrPlaceholder.innerHTML = `<strong>Estado: ${escapeHtml(d.waStatus)}</strong><span>Abre el Panel QR o espera unos segundos mientras inicializa.</span>`;
      }

      if (!silent) showToast("Bot Comercial sincronizado en vivo");
    } catch (err) {
      statusPill.className = "status-pill status-pill--revoked";
      statusPill.textContent = "Bot Offline (:3001)";
      if (descEl) {
        descEl.innerHTML = `No se detectó <code>client-sales-bot.ts</code> en <code>${escapeHtml(botBase)}</code> (${escapeHtml(err.message)}). Inicia tu servidor con <code>npm run dev:client-bot</code> y pulsa <strong>Sincronizar Bot</strong>.`;
      }
      if (!silent) showToast("No se pudo conectar al Bot Comercial en " + botBase);
    }
  }

  function downloadClientEnvTemplate() {
    const a = state.activeAccess;
    if (!a) return;
    const envText = [
      `# Configuración generada desde Ckekea para ${a.customerName}`,
      `BOT_NAME="${BASE.bot.name}"`,
      `COMPANY_NAME="${BASE.brand.name}"`,
      `WHATSAPP_ENABLED=true`,
      `WHATSAPP_BOT_NUMBER=${BASE.bot.whatsappNumberEnv}`,
      `WHATSAPP_SESSION_PATH=${BASE.bot.whatsappSessionPath}`,
      ``,
      `# Bot Comercial Entregable (client-sales-bot.ts)`,
      `CLIENT_PLAN=${a.clientBotPlan || "PRO"}`,
      `CLIENT_BOT_NAME=${BASE.bot.name}`,
      `CLIENT_BUSINESS_NAME="${a.customerName}"`,
      `CLIENT_BUSINESS_RUBRO="${a.businessType || "RETAIL"}"`,
      `CLIENT_TENANT_ID=${a.tenantId || ""}`,
      `CLIENT_TENANT_EMAIL=${a.customerEmail || ""}`,
      `CLIENT_OWNER_PHONE=${a.customerPhone || BASE.bot.whatsappNumberRaw}`,
      `CLIENT_PAYMENT_BANK="${BASE.payment.bankName} (${BASE.payment.bankCode})"`,
      `CLIENT_PAYMENT_PHONE=${BASE.payment.phoneFormatted}`,
      `CLIENT_PAYMENT_RIF=${BASE.payment.cedulaFormatted}`,
      `CLIENT_PAYMENT_BENEFICIARY="${BASE.payment.holderName}"`,
      `CLIENT_WHATSAPP_ENABLED=true`,
      `CLIENT_WHATSAPP_SESSION_PATH=${BASE.bot.whatsappSessionPath}`,
      `CLIENT_BOT_PORT=3001`,
      `# X-API-Key: ${a.apiKey}`,
      ""
    ].join("\n");

    downloadFile(".env.client-bot", envText, "text/plain");
    showToast("Archivo .env.client-bot descargado con BOT_NAME=Max");
  }

  async function downloadWeeklyPdf() {
    const url = joinUrl(state.apiConfig.clientBotBaseUrl, state.apiConfig.clientBotPdfEndpoint || "/api/reports/weekly-pdf");
    try {
      const res = await fetch(url, { headers: buildBotPanelHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      downloadFile(`cierre-semanal-ckekea-${new Date().toISOString().slice(0, 10)}.pdf`, blob, "application/pdf");
      showToast("PDF de Cierre Semanal descargado");
    } catch (err) {
      showToast(`Inicia client-sales-bot.ts en ${state.apiConfig.clientBotBaseUrl} para descargar el PDF (${err.message})`);
    }
  }

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
      box.textContent = `No se pudo consultar ${state.apiConfig.baseUrl}/api/v1/chatbot/conversations (${err.message}).`;
    }
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
    const scrollBody = backdrop.querySelector(".modal-scroll-body");
    if (scrollBody) scrollBody.scrollTop = 0;
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
    waBtn.href = buildWhatsAppUrl(founder.whatsappText, BASE.bot.whatsappNumberRaw);
    waBtn.textContent = `Escribir a Max / Equipo (${BASE.bot.whatsappNumberDisplay})`;

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
  // PASARELA PAGO MÓVIL -> PROVISIÓN REAL (Prisma PlanType LITE | PRO)
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
    const prismaPlanEnum = plan.apiPlanEnum || (plan.id === "estandar" ? "LITE" : "PRO");
    const clientBotPlan = plan.clientBotPlan || plan.id.toUpperCase();
    const amountUsd = getPlanPriceUsd(plan);
    const amountBs = Number((amountUsd * state.exchangeRateBs).toFixed(2));
    const submitBtn = document.getElementById("confirmPaymentBtn");

    submitBtn.disabled = true;
    submitBtn.textContent = "Verificando pago y generando API Key...";

    let apiKey = generateFallbackApiKey(plan.id);
    let tenantId = `tenant_${Date.now().toString(36)}`;
    let provisionSource = "local_fallback";
    let webhookNote =
      "Acceso activado en modo local. Enciende standalone-chatbot-api.ts y coloca tu API Key Maestra en API Studio para emitir en Prisma.";

    const provisionUrl = joinUrl(
      state.apiConfig.baseUrl,
      state.apiConfig.provisionEndpoint || "/api/v1/chatbot/api-keys/generate"
    );

    // Esquema exacto de CreateClientApiKeySchema en standalone-chatbot-api.ts (plan: LITE | PRO)
    const apiKeyPayload = {
      name: customerName,
      email: customerEmail,
      plan: prismaPlanEnum,
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
          webhookNote = `Tenant (${tenantId}) y API Key real generados en tu servidor (${provisionUrl}).`;
        } else if (state.apiConfig.mode === "remote_only") {
          const errMsg = (bodyJson && bodyJson.error && bodyJson.error.message) || `HTTP ${res.status}`;
          throw new Error(errMsg);
        } else {
          const errMsg = (bodyJson && bodyJson.error && bodyJson.error.message) || `HTTP ${res.status}`;
          webhookNote = `Servidor respondió (${errMsg}); se emitió respaldo local para desbloquear tu portal.`;
        }
      } catch (err) {
        if (state.apiConfig.mode === "remote_only") {
          submitBtn.disabled = false;
          submitBtn.textContent = "Confirmar Pago y Desbloquear Bot + API";
          showToast(`Error en API de provisión: ${err.message}`);
          return;
        }
        webhookNote = `Servidor ${state.apiConfig.baseUrl} offline (${err.message}). Acceso local activado al instante.`;
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
      planEnum: prismaPlanEnum,
      clientBotPlan,
      planName: plan.name,
      amountUsd,
      amountBs,
      apiKey,
      provisionSource,
      status: "active",
      createdAt: new Date().toLocaleString("es-VE")
    };

    state.generatedKeys.unshift(record);

    // Si el cliente tiene sesión JWT iniciada, registrar pago y actualizar plan directo en Neon PostgreSQL
    const jwtToken = localStorage.getItem("ckekea_auth_jwt_v1");
    if (jwtToken) {
      const apiOrigin =
        window.location.protocol === "http:" || window.location.protocol === "https:"
          ? window.location.origin
          : (BASE.platform && BASE.platform.apiBaseUrl) || "http://localhost:3000";
      fetch(`${apiOrigin.replace(/\/+$/, "")}/api/payments/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          planTier: clientBotPlan,
          reference,
          originBank,
          amountUsd
        })
      }).catch(() => {});
    }

    unlockClientAccess({
      tenantId,
      customerName,
      customerEmail,
      customerPhone,
      businessType,
      planId: plan.id,
      planEnum: prismaPlanEnum,
      clientBotPlan,
      planName: plan.name,
      apiKey,
      reference,
      unlockedAt: new Date().toISOString()
    });
    renderKeysTable();

    document.getElementById("paymentStepForm").hidden = true;
    document.getElementById("paymentStepSuccess").hidden = false;
    document.getElementById("successPlanDesc").textContent =
      `Plan ${plan.name} (${businessType}) activado para ${customerName}. Ya tienes acceso completo a Max y tu API.`;
    document.getElementById("freshApiKeyValue").textContent = apiKey;
    document.getElementById("freshWebhookStatus").textContent = webhookNote;

    const receiptWaMessage =
      `Hola Max / equipo Ckekea, acabo de pagar mi Plan ${plan.name} por Pago Móvil Mercantil.\n` +
      `• Negocio/Cliente: ${customerName}\n` +
      `• Rubro: ${businessType}\n` +
      `• Monto: $${amountUsd} USD (Bs. ${formatBs(amountUsd)})\n` +
      `• Banco emisor: ${originBank}\n` +
      `• Referencia: ${reference}\n` +
      `• Tenant ID: ${tenantId}\n` +
      `• API Key: ${apiKey}`;

    document.getElementById("sendReceiptWhatsappBtn").href = buildWhatsAppUrl(
      receiptWaMessage,
      BASE.bot.whatsappNumberRaw
    );

    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar Pago y Desbloquear Bot + API";
    document.getElementById("paymentCheckoutForm").reset();
    showToast(`¡Pago confirmado! Bot Max y API desbloqueados (${plan.name})`);
  }

  // ==========================================================================
  // API STUDIO (api-studio.html)
  // ==========================================================================
  function hydrateApiConfigForm() {
    if (!document.getElementById("cfgBaseUrl")) return;

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

    renderUploadedSpec();
    renderKeysTable();
    renderCodeSnippets();
  }

  function renderUploadedSpec() {
    const spec = state.apiConfig.uploadedSpec || BASE.apiStudio.uploadedSpec;
    const titleEl = document.getElementById("loadedSpecTitle");
    const fileEl = document.getElementById("loadedSpecFilename");
    const descEl = document.getElementById("loadedSpecDesc");
    const listEl = document.getElementById("loadedSpecEndpoints");

    if (titleEl) titleEl.textContent = (spec.info && spec.info.title) || "API Personalizada";
    if (fileEl) fileEl.textContent = state.apiConfig.uploadedSpecName || "ckekea-chatbot-apirest-v2.json";
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
          const baseInput = document.getElementById("cfgBaseUrl");
          if (baseInput) baseInput.value = parsed.servers[0].url;
        }
        saveState();
        renderUploadedSpec();
        renderCodeSnippets();
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
            Aún no hay API Keys generadas. Completa un pago o pulsa <strong>"+ Generar Key de prueba"</strong>.
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
    const curlEl = document.getElementById("curlSnippet");
    const jsEl = document.getElementById("jsSnippet");
    if (!curlEl && !jsEl) return;

    const endpoint = joinUrl(state.apiConfig.baseUrl || "http://localhost:3000", state.apiConfig.chatEndpoint || "/api/v1/chatbot/message");
    const sampleKey =
      (state.activeAccess && state.activeAccess.apiKey) ||
      state.lastGeneratedKey ||
      (state.generatedKeys[0] && state.generatedKeys[0].apiKey) ||
      "sk_live_tu_api_key_generada";
    const customerName = (state.activeAccess && state.activeAccess.customerName) || "Cliente Ckekea";
    const customerPhone = (state.activeAccess && state.activeAccess.customerPhone) || BASE.bot.whatsappNumberRaw;

    if (curlEl) {
      curlEl.textContent =
`# Consultar a Max / Chatbot API (standalone-chatbot-api.ts)
curl -X POST "${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${sampleKey}" \\
  -d '{
    "message": "1",
    "customer_phone": "${customerPhone}",
    "customer_name": "${customerName}"
  }'`;
    }

    if (jsEl) {
      jsEl.textContent =
`// Consumir Max / Ckekea API (standalone-chatbot-api.ts)
const res = await fetch("${endpoint}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${sampleKey}"
  },
  body: JSON.stringify({
    message: "Hola Max, quiero ver los planes",
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
      `// Archivo generado desde Ckekea API Studio (${new Date().toLocaleString("es-VE")})\n` +
      `// Reemplaza tu config.js en la carpeta del proyecto para guardar estos cambios.\n\n` +
      `window.CHEKEA_CONFIG = ${JSON.stringify(updatedConfig, null, 2)};\n`;

    downloadFile("config.js", content, "application/javascript");
    showToast("Descargado config.js actualizado");
  }

  // ==========================================================================
  // MOTOR CONVERSACIONAL REAL DE MAX DE CKEKEA (FIEL A bot.ai.ts / bot.service.ts)
  // ==========================================================================
  function getMaxWelcomeText() {
    const name = (state.activeAccess && state.activeAccess.customerName.split(" ")[0]) || "amigo";
    return [
      `Hola, *${name}*. Soy *${BASE.bot.name}* de *${BASE.brand.name}*.`,
      `¿En qué te ayudo hoy?`,
      ``,
      `1. *Planes* (Estándar, Pro y Gold)`,
      `2. *Demo de venta*`,
      `3. *Seguridad y ERP*`,
      `4. *Diagnóstico rápido*`,
      ``,
      `Escribe el número o contáctame directo en WhatsApp al *${BASE.bot.whatsappNumberDisplay}*.`
    ].join("\n");
  }

  function runMaxLocalFlow(rawInput) {
    const q = normalizeText(rawInput);
    const ms = state.maxSession;
    const firstName = (state.activeAccess && state.activeAccess.customerName.split(" ")[0]) || "amigo";

    if (/^(cancelar|salir|reiniciar|no gracias|detener)$/.test(q)) {
      ms.step = "MAIN_MENU";
      ms.demoProduct = null;
      return {
        text: [
          `Listo, *${firstName}*, flujo cancelado.`,
          ``,
          `1. *Planes*`,
          `2. *Demo de venta*`,
          `3. *Seguridad y ERP*`,
          `4. *Diagnóstico rápido*`,
          ``,
          `¿Qué deseas revisar ahora?`
        ].join("\n"),
        sourceLabel: "Max · Ckekea"
      };
    }

    if (/^(menu|inicio|hola|buenas|ayuda)$/.test(q)) {
      ms.step = "MAIN_MENU";
      return { text: getMaxWelcomeText(), sourceLabel: "Max · Ckekea" };
    }

    if (q.includes("whatsapp") || q.includes("416") || q.includes("asesor") || q.includes("humano")) {
      return {
        text: `Perfecto, *${firstName}*. Puedes continuar esta misma conversación directo con *Max* en WhatsApp al *${BASE.bot.whatsappNumberDisplay}* (sesión *${BASE.bot.whatsappSessionPath}*).`,
        actionType: "whatsapp",
        waMessage: `Hola Max de Ckekea, vengo desde la web (${firstName}) y quiero continuar por WhatsApp.`,
        sourceLabel: "Max · WhatsApp"
      };
    }

    if (ms.step === "DEMO_PRODUCT") {
      const idx = parseInt(q, 10);
      let picked = DEMO_PRODUCTS[idx - 1];
      if (!picked) {
        picked = DEMO_PRODUCTS.find((p) => normalizeText(p.name).includes(q) || q.includes("combo"));
      }
      if (!picked) picked = DEMO_PRODUCTS[0];
      ms.demoProduct = picked;
      ms.step = "DEMO_QTY";
      return {
        text: `Excelente elección: *${picked.name}* (*$${picked.price.toFixed(2)}* · aprox. Bs. ${formatBs(picked.price)}).\n¿Cuántas unidades deseas llevar? (Ej: *1*, *2*, *3*)`,
        sourceLabel: "Max · Demo Venta"
      };
    }

    if (ms.step === "DEMO_QTY") {
      const num = parseInt(q.replace(/\D/g, ""), 10) || 1;
      ms.demoQty = Math.max(1, Math.min(20, num));
      const total = ms.demoProduct.price * ms.demoQty;
      ms.step = "DEMO_CONFIRM";
      return {
        text: [
          `Resumen de tu demo: *${ms.demoQty}x ${ms.demoProduct.name}* — Total: *$${total.toFixed(2)}* (Bs. ${formatBs(total)})`,
          `¿Confirmas el pedido? Escribe *sí* para ver la validación de Pago Móvil o *cancelar*.`
        ].join("\n"),
        sourceLabel: "Max · Demo Venta"
      };
    }

    if (ms.step === "DEMO_CONFIRM") {
      if (/(si|confirmo|dale|ok|va|listo|1)/.test(q)) {
        const total = ms.demoProduct.price * ms.demoQty;
        const code = `DEM-${Math.floor(1000 + Math.random() * 9000)}`;
        ms.step = "DEMO_PAYMENT";
        return {
          text: [
            `Pedido demo *#${code}* apartado (*$${total.toFixed(2)}*):`,
            `• Banco: *${BASE.payment.bankName} (${BASE.payment.bankCode})*`,
            `• Teléfono: *${BASE.payment.phoneFormatted}* · C.I.: *${BASE.payment.cedulaFormatted}*`,
            ``,
            `Envíame 6 dígitos de prueba (ej. *849201*) para ver la conciliación bancaria instantánea.`
          ].join("\n"),
          sourceLabel: "Max · Demo Pago"
        };
      }
      ms.step = "MAIN_MENU";
      return { text: `Sin problema, reinicié la demo. ¿Probamos otra opción (1, 2, 3 o 4)?`, sourceLabel: "Max · Ckekea" };
    }

    if (ms.step === "DEMO_PAYMENT") {
      const ref = rawInput.replace(/\D/g, "").slice(0, 10) || "849201";
      ms.step = "MAIN_MENU";
      return {
        text: [
          `*Pago verificado en segundos* (Ref. demo *#${ref}*).`,
          `Así exactamente atenderá y validará *${BASE.bot.name}* a tus clientes 24/7 en WhatsApp, además de enviarte el *Cierre Semanal en PDF*.`,
          ``,
          `¿Quieres activar tu plan real ahora o seguir por WhatsApp al *${BASE.bot.whatsappNumberDisplay}*?`
        ].join("\n"),
        actionType: "checkout",
        sourceLabel: "Max · Pago Validado"
      };
    }

    if (ms.step === "DIAGNOSIS_BUSINESS") {
      ms.diagnosis.business = rawInput;
      ms.step = "DIAGNOSIS_VOLUME";
      return {
        text: `Excelente rubro (*${rawInput}*).\n¿Cuántos mensajes o pagos por Pago Móvil manejan aprox. al día? (Ej: *menos de 20*, *20 a 80*, *más de 80*)`,
        sourceLabel: "Max · Diagnóstico 2/3"
      };
    }

    if (ms.step === "DIAGNOSIS_VOLUME") {
      ms.diagnosis.volume = rawInput;
      ms.step = "DIAGNOSIS_BOTTLENECK";
      return {
        text: `Anotado. Última pregunta: ¿Usan algún sistema administrativo/ERP (*Saint, Profit Plus, A2, Valery, Premium Soft*) o cuál es hoy su mayor cuello de botella?`,
        sourceLabel: "Max · Diagnóstico 3/3"
      };
    }

    if (ms.step === "DIAGNOSIS_BOTTLENECK") {
      ms.diagnosis.bottleneck = rawInput;
      ms.step = "MAIN_MENU";
      const combined = normalizeText(`${ms.diagnosis.business} ${ms.diagnosis.volume} ${rawInput}`);
      let recPlan = "Pro";
      let recReason = "incluye Bot IA 24/7, Ckekea App y *API Bancaria en tiempo real* para validar cada Pago Móvil sin capturas falsas.";
      if (/(saint|profit|a2|valery|premium|erp|sucursal|cadena|100|mas de 80)/.test(combined)) {
        recPlan = "Gold";
        recReason = "conecta el Bot IA y la API Bancaria directo con tu *ERP* vía API REST y Webhooks firmados multi-sucursal.";
      } else if (/(empezando|pequeno|menos de 20|pocos|emprendimiento)/.test(combined)) {
        recPlan = "Estándar";
        recReason = "te da Bot IA 24/7 en WhatsApp + *Ckekea App* para catálogo, pedidos y alertas sin complicaciones.";
      }

      return {
        text: [
          `*Diagnóstico Ckekea para ${ms.diagnosis.business}:*`,
          `Te recomiendo el *Plan ${recPlan}*, porque ${recReason}`,
          ``,
          `Puedes activarlo aquí por Pago Móvil Mercantil o escribirme directo por WhatsApp (*${BASE.bot.whatsappNumberDisplay}*).`
        ].join("\n"),
        actionType: "checkout",
        waMessage: `Hola Max de Ckekea, hice el diagnóstico en la web (${ms.diagnosis.business} / ${ms.diagnosis.volume}) y me recomendaste el Plan ${recPlan}.`,
        sourceLabel: `Max · Recomienda ${recPlan}`
      };
    }

    if (q === "1" || q.includes("plan") || q.includes("precio")) {
      if (q.includes("estandar")) {
        return {
          text: `Buena opción, *${firstName}*. El *Plan Estándar* ($${getPlanPriceUsd(getPlanById("estandar"))}/mes) trae Bot IA 24/7 en WhatsApp + *${BASE.brand.appName}* para catálogo, pedidos, alertas Pago Móvil y PDF semanal.\n\n¿Vemos la *demo* (escribe *2*) o lo activamos ahora?`,
          actionType: "checkout",
          sourceLabel: "Max · Plan Estándar"
        };
      }
      if (q.includes("pro")) {
        return {
          text: `Excelente, *${firstName}*. El *Plan Pro* ($${getPlanPriceUsd(getPlanById("pro"))}/mes) suma *API Bancaria en tiempo real* al Bot IA y *${BASE.brand.appName}* para validar cada Pago Móvil en segundos sin capturas falsas.\n\n¿Probamos la *demo* (escribe *2*) o activamos el Plan Pro?`,
          actionType: "checkout",
          sourceLabel: "Max · Plan Pro"
        };
      }
      if (q.includes("gold")) {
        return {
          text: `Genial, *${firstName}*. El *Plan Gold* ($${getPlanPriceUsd(getPlanById("gold"))}/mes) une el Bot IA y la *API Bancaria* directo con tu ERP (*Saint, Profit Plus, A2, Valery, Premium Soft*) vía API REST para stock y facturación automática.\n\n¿Activamos tu plan o revisamos tu ERP por WhatsApp (*${BASE.bot.whatsappNumberDisplay}*)?`,
          actionType: "checkout",
          sourceLabel: "Max · Plan Gold"
        };
      }

      ms.step = "PLANS_MENU";
      return {
        text: [
          `Claro, *${firstName}*, estos son nuestros 3 planes en *${BASE.brand.name}*:`,
          ``,
          `• *Estándar ($${getPlanPriceUsd(getPlanById("estandar"))}/mes):* Bot IA 24/7 + *${BASE.brand.appName}* (catálogo, pedidos y stock).`,
          `• *Pro ($${getPlanPriceUsd(getPlanById("pro"))}/mes):* Lo anterior + *API Bancaria* (valida Pago Móvil en segundos).`,
          `• *Gold ($${getPlanPriceUsd(getPlanById("gold"))}/mes):* Lo anterior + enlace a tu *ERP* (Saint, Profit Plus, A2, Valery, Premium Soft).`,
          ``,
          `Escríbeme *Estándar*, *Pro* o *Gold* para ver detalles.`
        ].join("\n"),
        sourceLabel: "Max · Planes"
      };
    }

    if (ms.step === "PLANS_MENU" && /(estandar|pro|gold)/.test(q)) {
      ms.step = "MAIN_MENU";
      return runMaxLocalFlow(`plan ${q}`);
    }

    if (q === "2" || q.includes("demo") || q.includes("venta") || q.includes("combo") || q.includes("catalogo")) {
      ms.step = "DEMO_PRODUCT";
      return {
        text: [
          `Iniciemos la *Demo de venta* en vivo, *${firstName}*:`,
          `Elige un producto escribiendo su número:`,
          ``,
          `1. *Combo Emprendedor* — *$25.00* (Disponible)`,
          `2. *Kit Farmacia Express* — *$38.00* (Disponible)`,
          `3. *Pack Ferretería Pro* — *$45.00* (Disponible)`
        ].join("\n"),
        sourceLabel: "Max · Demo Venta"
      };
    }

    if (q === "3" || q.includes("seguridad") || q.includes("erp") || q.includes("iso") || q.includes("saint") || q.includes("profit") || q.includes("valery") || q.includes("api")) {
      return {
        text: [
          `En *${BASE.brand.name}* protegemos tus cobros y tu inventario bajo *ISO/IEC 27001:2022 y OWASP API Top 10*, *${firstName}*:`,
          ``,
          `• *API Bancaria:* valida cada Pago Móvil directo con el banco (cero capturas falsas).`,
          `• *API REST / ERP:* enlaza WhatsApp con *Saint, Profit Plus, A2, Valery o Premium Soft* y alerta en *${BASE.brand.appName}*.`,
          `• *Cierre Semanal PDF:* reporte automático de ventas y movimientos.`,
          ``,
          `¿Quieres hacer el *Diagnóstico rápido* (escribe *4*) o hablar con Max en WhatsApp (*${BASE.bot.whatsappNumberDisplay}*)?`
        ].join("\n"),
        sourceLabel: "Max · Seguridad & ERP"
      };
    }

    if (q === "4" || q.includes("diagnostico") || q.includes("recomienda")) {
      ms.step = "DIAGNOSIS_BUSINESS";
      return {
        text: `Hagamos un *Diagnóstico rápido* en 3 preguntas, *${firstName}*.\n1/3: ¿Cuál es el rubro de tu negocio? (Ej: farmacia, ferretería, tecnología, repuestos...)`,
        sourceLabel: "Max · Diagnóstico 1/3"
      };
    }

    if (q.includes("pago") || q.includes("mercantil") || q.includes("banco") || q.includes("movil")) {
      return {
        text: [
          `Datos de Pago Móvil Venezuela para activar tu plan:`,
          `• Banco: *${BASE.payment.bankName} (${BASE.payment.bankCode})*`,
          `• Cédula: *${BASE.payment.cedulaFormatted}*`,
          `• Teléfono: *${BASE.payment.phoneFormatted}*`,
          `• Titular: *${BASE.payment.holderName}*`,
          `Pulsa abajo para abrir la pasarela y recibir tu *X-API-Key* al instante.`
        ].join("\n"),
        actionType: "checkout",
        sourceLabel: "Max · Pagos"
      };
    }

    if (q.includes("fundador") || q.includes("fidel") || q.includes("jesus") || q.includes("jose") || q.includes("equipo")) {
      return {
        text: [
          `El equipo detrás de *${BASE.brand.name}*:`,
          `• *Fidel Pereira* — Fundador`,
          `• *Jesús Romero* — CEO`,
          `• *José Davalillo* — Ingeniero y Desarrollador de Software`,
          `Puedes ver sus perfiles detallados en la página *Fundadores*.`
        ].join("\n"),
        sourceLabel: "Max · Ckekea"
      };
    }

    return {
      text: `Entendido, *${firstName}*. Para ayudarte más rápido, dime un número del menú:\n1. *Planes* · 2. *Demo de venta* · 3. *Seguridad y ERP* · 4. *Diagnóstico rápido*\nO escríbeme directo al WhatsApp *${BASE.bot.whatsappNumberDisplay}*.`,
      actionType: "whatsapp",
      waMessage: `Hola Max de Ckekea: ${rawInput}`,
      sourceLabel: "Max · Ckekea"
    };
  }

  function updateChatStatusBadge() {
    const badge = document.getElementById("chatConnectionBadge");
    if (!badge) return;
    const engineSelect = document.getElementById("chatEngineSelect");
    const mode = engineSelect ? engineSelect.value : "max_local";

    if (mode === "standalone_api" && state.activeAccess) {
      badge.innerHTML = `<span class="status-dot status-dot--green"></span>API SaaS (${escapeHtml(state.apiConfig.baseUrl)})`;
    } else if (mode === "client_bot" && state.activeAccess) {
      badge.innerHTML = `<span class="status-dot status-dot--green"></span>Bot Comercial (${escapeHtml(state.apiConfig.clientBotBaseUrl)})`;
    } else {
      badge.innerHTML = `<span class="status-dot status-dot--green"></span>Max Bot Activo · ${escapeHtml(BASE.bot.whatsappNumberDisplay)}`;
    }
  }

  function appendChatMessage(containerId, text, sender, metaExtra) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const div = document.createElement("div");
    div.className = `chat-msg chat-msg--${sender}`;
    const time = new Date().toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });

    const svgUp = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;
    const svgDown = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;
    const svgCard = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;
    const svgMsg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

    let extrasHtml = "";
    if (sender === "bot" && metaExtra) {
      if (metaExtra.queryId && state.activeAccess) {
        extrasHtml += `
          <div class="chat-rate-row">
            <button type="button" class="chat-rate-btn" data-rate-query="${escapeHtml(metaExtra.queryId)}" data-rate-val="true">${svgUp} Útil</button>
            <button type="button" class="chat-rate-btn" data-rate-query="${escapeHtml(metaExtra.queryId)}" data-rate-val="false">${svgDown} Mejorar</button>
          </div>
        `;
      }
      if (metaExtra.actionType === "checkout") {
        const waHref = buildWhatsAppUrl(metaExtra.waMessage || BASE.bot.defaultGreeting, BASE.bot.whatsappNumberRaw);
        extrasHtml += `
          <div class="chat-rate-row">
            <button type="button" class="chat-rate-btn" data-open-payment="pro">${svgCard} Activar Plan</button>
            <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="chat-rate-btn">${svgMsg} WhatsApp Max</a>
          </div>
        `;
      } else if (metaExtra.actionType === "whatsapp") {
        const waHref = buildWhatsAppUrl(metaExtra.waMessage || BASE.bot.defaultGreeting, BASE.bot.whatsappNumberRaw);
        extrasHtml += `
          <div class="chat-rate-row">
            <a href="${waHref}" target="_blank" rel="noopener noreferrer" class="chat-rate-btn">${svgMsg} Abrir WhatsApp (${escapeHtml(BASE.bot.whatsappNumberDisplay)})</a>
          </div>
        `;
      }
    }

    const label = sender === "user" ? "Tú" : (metaExtra && metaExtra.sourceLabel) || `${BASE.bot.name} · ${BASE.brand.name}`;
    div.innerHTML = `${formatRichBotText(text)}${extrasHtml}<span class="chat-msg__meta">${escapeHtml(label)} · ${time}</span>`;
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
        showToast("Gracias por calificar la respuesta de Max");
      }
    } catch {
      showToast("No se pudo enviar la calificación al servidor");
    }
  }

  async function generateBotReply(userMessage, attachment) {
    const engineSelect = document.getElementById("chatEngineSelect");
    const engineMode = engineSelect ? engineSelect.value : "max_local";

    // Si eligió API SaaS (:3000) o Bot Comercial (:3001) y tiene acceso desbloqueado
    if (engineMode !== "max_local") {
      if (!state.activeAccess || !state.activeAccess.apiKey) {
        return {
          text: `Para conectar directo a *${engineMode === "client_bot" ? "Bot Comercial (:3001)" : "API SaaS (:3000)"}*, primero paga un plan o ingresa tu API Key. Mientras tanto puedes cambiar el selector a *Max Ckekea (Web)* y conversar conmigo.`,
          actionType: "checkout",
          sourceLabel: "Acceso Requerido"
        };
      }

      const customerPhone = (state.activeAccess.customerPhone || BASE.bot.whatsappNumberRaw).replace(/\D/g, "") || "api-client";
      const customerName = state.activeAccess.customerName || "Cliente";

      if (engineMode === "client_bot") {
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
            return { text: json.data.text, sourceLabel: `Bot Comercial (${json.data.plan})` };
          }
          throw new Error((json && json.error) || `HTTP ${res.status}`);
        } catch (err) {
          return {
            text: `client-sales-bot.ts no respondió en ${botChatUrl} (${err.message}). Mientras lo enciendes, te respondo desde el motor web de Max:\n\n${runMaxLocalFlow(userMessage).text}`,
            sourceLabel: "Max · Respaldo"
          };
        }
      }

      if (engineMode === "standalone_api") {
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
              text: json.data.response || "Respuesta recibida.",
              queryId: json.data.query_id,
              sourceLabel: `API SaaS (${json.data.state || "OK"})`
            };
          }
          throw new Error((json && json.error && json.error.message) || `HTTP ${res.status}`);
        } catch (err) {
          return {
            text: `standalone-chatbot-api.ts no respondió en ${apiChatUrl} (${err.message}). Respaldo de Max activo:\n\n${runMaxLocalFlow(userMessage).text}`,
            sourceLabel: "Max · Respaldo"
          };
        }
      }
    }

    // Motor web nativo de Max de Ckekea
    if (attachment && !userMessage) {
      return {
        text: `Imagen recibida (*${attachment.filename}*). Con el Plan Pro/Gold en vivo, Max extrae el producto o valida el comprobante automáticamente vía IA de visión Base64. ¿Qué deseas consultar?`,
        sourceLabel: "Max · Visión IA"
      };
    }

    return runMaxLocalFlow(userMessage);
  }

  async function sendChat(text, sourceContainer) {
    const clean = text.trim();
    const attachment = state.pendingAttachment;
    if (!clean && !attachment) return;

    const displayUserText = attachment ? `${clean || "[Imagen adjunta]"} (${attachment.filename})` : clean;
    appendChatMessage("embeddedChatMessages", displayUserText, "user");
    appendChatMessage("floatingChatMessages", displayUserText, "user");
    clearChatAttachment();

    await new Promise((r) => setTimeout(r, 260));
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
    state.maxSession = {
      step: "MAIN_MENU",
      demoProduct: null,
      demoQty: 1,
      diagnosis: { business: "", volume: "", bottleneck: "" }
    };
    const emb = document.getElementById("embeddedChatMessages");
    const flt = document.getElementById("floatingChatMessages");
    if (emb) emb.innerHTML = "";
    if (flt) flt.innerHTML = "";
    const welcome = getMaxWelcomeText();
    appendChatMessage("embeddedChatMessages", welcome, "bot", { sourceLabel: "Max · Ckekea" });
    appendChatMessage("floatingChatMessages", welcome, "bot", { sourceLabel: "Max · Ckekea" });
  }

  // ==========================================================================
  // ANIMACIONES & EVENTOS GLOBALES
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
      { threshold: 0.08 }
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

    // Botones acceso API Key
    const handleOpenUnlock = () => {
      if (state.activeAccess) {
        if (currentPage === "chatbot") {
          const sec = document.getElementById("chatbot");
          if (sec) sec.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "chatbot.html";
        }
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
      const clientBotPlan = document.getElementById("unlockPlanInput").value || "PRO";
      if (!apiKey) return;

      unlockClientAccess({
        tenantId: "manual-key",
        customerName,
        customerEmail: "",
        customerPhone: BASE.bot.whatsappNumberRaw,
        businessType: "RETAIL",
        planId: clientBotPlan.toLowerCase(),
        planEnum: clientBotPlan === "ESTANDAR" ? "LITE" : "PRO",
        clientBotPlan,
        planName: clientBotPlan,
        apiKey,
        unlockedAt: new Date().toISOString()
      });
      closeAllModals();
      showToast("¡Acceso desbloqueado con tu API Key!");
      if (currentPage !== "chatbot") {
        window.location.href = "chatbot.html";
      } else {
        initChatWelcome();
      }
    });

    onId("logoutAccessBtn", "click", () => {
      state.activeAccess = null;
      state.conversationId = null;
      saveState();
      renderAccessPortal();
      initChatWelcome();
      showToast("Sesión de acceso cerrada");
    });

    // Acciones Portal Desbloqueado (chatbot.html)
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
        const res = await fetch(url, { method: "POST", headers: buildBotPanelHeaders(), body: "{}" });
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
      const val = document.getElementById("chatEngineSelect").value;
      const msg =
        val === "client_bot"
          ? "Motor cambiado a Bot Comercial (:3001)"
          : val === "standalone_api"
            ? "Motor cambiado a API SaaS (:3000)"
            : "Motor cambiado a Max Ckekea (Web)";
      showToast(msg);
    });

    // Adjuntar imagen Base64
    const chatImgInput = document.getElementById("chatImageInput");
    onId("chatAttachImageBtn", "click", () => {
      if (chatImgInput) chatImgInput.click();
    });
    if (chatImgInput) {
      chatImgInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const parts = String(reader.result || "").split(",");
          state.pendingAttachment = {
            base64: parts[1] || "",
            mimeType: file.type || "image/jpeg",
            filename: file.name
          };
          document.getElementById("chatAttachmentName").textContent = `Archivo adjunto: ${file.name}`;
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

      const promptChip = e.target.closest(".prompt-chip[data-prompt]");
      if (promptChip) {
        const inFloating = Boolean(promptChip.closest("#floatingChatDrawer"));
        sendChat(promptChip.dataset.prompt, inFloating ? "floating" : "embedded");
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
            clientBotPlan: rec.clientBotPlan || "PRO",
            planName: rec.planName,
            apiKey: rec.apiKey,
            unlockedAt: new Date().toISOString()
          });
          showToast(`Acceso activado para ${rec.customerName}`);
          window.location.href = "chatbot.html";
        }
        return;
      }

      const keyCopyBtn = e.target.closest("[data-key-copy]");
      if (keyCopyBtn) {
        copyToClipboard(keyCopyBtn.dataset.keyCopy, "API Key copiada");
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
      if (currentPage === "chatbot") {
        const sec = document.getElementById("chatbot");
        if (sec) sec.scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.href = "chatbot.html";
      }
    });

    onId("goToStudioKeysBtn", "click", () => {
      closeAllModals();
      if (currentPage === "api-studio") {
        activateStudioTab("keys");
        const studio = document.getElementById("api-studio");
        if (studio) studio.scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.href = "api-studio.html#keys";
      }
    });

    // API Studio
    document.querySelectorAll("[data-studio-tab]").forEach((tab) => {
      tab.addEventListener("click", () => activateStudioTab(tab.dataset.studioTab));
    });

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
      showToast("Configuración guardada para todas las páginas");
    });

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
          return `${label} (${url}/health): OK HTTP ${res.status} — ${JSON.stringify(data)}`;
        } catch (err) {
          return `${label} (${url}/health): Sin respuesta (${err.message})`;
        }
      };

      const [r1, r2] = await Promise.all([
        checkHealth("1) Standalone Chatbot API", apiBase),
        checkHealth("2) Client Sales Bot", botBase)
      ]);
      output.textContent = `${r1}\n${r2}`;
    });

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

    onId("manualGenerateKeyBtn", "click", () => {
      const apiKey = generateFallbackApiKey("pro");
      state.generatedKeys.unshift({
        id: `tx_${Date.now()}`,
        tenantId: `tenant_${Date.now().toString(36)}`,
        customerName: "Cliente Demo",
        customerEmail: "demo@ckekea.io",
        customerPhone: BASE.bot.whatsappNumberRaw,
        businessType: "RETAIL",
        originBank: "Mercantil (0105)",
        reference: String(Math.floor(100000 + Math.random() * 899999)),
        planId: "pro",
        planEnum: "PRO",
        clientBotPlan: "PRO",
        planName: "Pro",
        amountUsd: getPlanPriceUsd(getPlanById("pro")),
        amountBs: Number((getPlanPriceUsd(getPlanById("pro")) * state.exchangeRateBs).toFixed(2)),
        apiKey,
        status: "active",
        createdAt: new Date().toLocaleString("es-VE")
      });
      state.lastGeneratedKey = apiKey;
      saveState();
      renderKeysTable();
      renderCodeSnippets();
      showToast("API Key de prueba generada — pulsa 'Usar' para abrir el portal");
    });

    onId("exportKeysJsonBtn", "click", () => {
      downloadFile("ckekea-api-keys.json", JSON.stringify(state.generatedKeys, null, 2), "application/json");
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

    // Modal de WhatsApp: alternador entre Bot Max (+584166214410) y Pagos/Equipo (0424-6003606)
    const waTextarea = document.getElementById("waCustomMessage");
    const waSubmitBtn = document.getElementById("waSubmitBtn");

    document.querySelectorAll(".wa-channel-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedWaChannel = btn.dataset.waChannel || BASE.bot.whatsappNumberRaw;
        document.querySelectorAll(".wa-channel-btn").forEach((b) => b.classList.toggle("is-active", b === btn));
        if (waSubmitBtn) {
          waSubmitBtn.textContent =
            state.selectedWaChannel === BASE.payment.whatsappSupportRaw
              ? `Abrir WhatsApp Pagos (${BASE.payment.phoneFormatted})`
              : `Abrir WhatsApp con Max (${BASE.bot.whatsappNumberDisplay})`;
        }
      });
    });

    document.querySelectorAll(".wa-topic").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".wa-topic").forEach((b) => b.classList.toggle("is-active", b === btn));
        if (waTextarea) waTextarea.value = btn.dataset.waMsg;
      });
    });

    onId("whatsappDirectForm", "submit", (e) => {
      e.preventDefault();
      const msg = (waTextarea && waTextarea.value.trim()) || BASE.bot.defaultGreeting;
      window.open(buildWhatsAppUrl(msg, state.selectedWaChannel), "_blank", "noopener,noreferrer");
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

    renderSecurityGrid();
    renderPlans();
    renderFounders();
    hydrateApiConfigForm();
    renderAccessPortal();
    initChatWelcome();
    bindEvents();
    initScrollReveal();

    // Si llegamos a api-studio.html#keys, abrir la pestaña de API Keys automáticamente
    if (currentPage === "api-studio" && window.location.hash === "#keys") {
      activateStudioTab("keys");
    }

    if (!sessionStorage.getItem(STORAGE_KEYS.WA_POPUP_SEEN)) {
      setTimeout(() => {
        const anyModalOpen = document.querySelector(".modal-backdrop.is-open");
        if (!anyModalOpen) {
          sessionStorage.setItem(STORAGE_KEYS.WA_POPUP_SEEN, "1");
          showToast(`Habla con Max en WhatsApp (${BASE.bot.whatsappNumberDisplay}) o prueba el chat`);
        }
      }, 4500);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
