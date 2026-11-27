/**
 * ============================================================================
 * CKEKEA — SHELL COMPARTIDO MULTIPÁGINA (WEB PÚBLICA vs ESPACIO PRIVADO)
 * ============================================================================
 * - En páginas públicas (index, chatbot, planes, api-studio, fundadores, login):
 *   Muestra el menú comercial limpio (SIN "Dashboard" ni "Admin").
 * - En el espacio privado (dashboard.html y admin.html):
 *   Elimina todas las opciones del menú público y muestra un menú independiente
 *   solo con "Dashboard Principal" y "Panel Admin" (si es SUPERADMIN).
 */

(function () {
  "use strict";

  const BASE = window.CHEKEA_CONFIG;
  const currentPage = (document.body.getAttribute("data-page") || "inicio").toLowerCase();
  const isPrivateWorkspace = currentPage === "dashboard" || currentPage === "admin";

  function getStoredUser() {
    try {
      const raw = localStorage.getItem("ckekea_auth_user_v1");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const storedUser = getStoredUser();
  const isSuperadmin = Boolean(storedUser && storedUser.role === "SUPERADMIN");

  const PUBLIC_NAV_ITEMS = [
    { key: "inicio", href: "index.html", label: "Inicio" },
    { key: "chatbot", href: "chatbot.html", label: "Max IA" },
    { key: "planes", href: "planes.html", label: "Planes" },
    { key: "api-studio", href: "api-studio.html", label: "API Studio" },
    { key: "fundadores", href: "fundadores.html", label: "Fundadores" }
  ];

  const PRIVATE_NAV_ITEMS = [
    { key: "dashboard", href: "dashboard.html", label: "Dashboard Principal" }
  ];
  if (isSuperadmin) {
    PRIVATE_NAV_ITEMS.push({ key: "admin", href: "admin.html", label: "Panel Admin" });
  }

  function renderNavLinks(items, isMobile) {
    return items
      .map((item) => {
        const active = item.key === currentPage ? ' class="is-active" aria-current="page"' : "";
        const label = isMobile && item.key === "planes" ? "Planes Estándar, Pro y Gold" : item.label;
        return `<a href="${item.href}"${active}>${label}</a>`;
      })
      .join("");
  }

  const BRAND_LOCKUP_HTML = `
    <span class="brand__svg-wrap" aria-hidden="true">
      <img src="assets/sinkroo-icon.svg" alt="" class="brand__svg-icon" width="32" height="28" />
    </span>
    <span class="brand__wordmark" aria-label="SINKR∞">SINKR<span class="brand__inf">∞</span></span>
  `;

  const LANG_SWITCH_HTML = `
    <div class="lang-switch" role="group" aria-label="Idioma / Language">
      <button type="button" class="lang-switch__btn is-active" data-set-lang="es" aria-pressed="true">ES</button>
      <button type="button" class="lang-switch__btn" data-set-lang="en" aria-pressed="false">EN</button>
    </div>
  `;

  function injectHeader() {
    const mount = document.getElementById("siteHeader");
    if (!mount) return;

    if (isPrivateWorkspace) {
      // MENÚ INDEPENDIENTE EXCLUSIVO PARA DASHBOARD PRINCIPAL Y PANEL ADMIN
      mount.innerHTML = `
        <header class="navbar navbar--workspace" id="navbar">
          <div class="container container--workspace navbar__inner">
            <a href="dashboard.html" class="brand" aria-label="${BASE.brand.name} Workspace">
              ${BRAND_LOCKUP_HTML}
              <span class="workspace-tag">${isSuperadmin || currentPage === "admin" ? "Admin" : "Workspace"}</span>
            </a>

            <nav class="nav-links nav-links--workspace" aria-label="Menú del panel">
              ${renderNavLinks(PRIVATE_NAV_ITEMS, false)}
            </nav>

            <div class="navbar__actions">
              ${LANG_SWITCH_HTML}
              <button type="button" class="btn btn--ghost btn--sm" id="workspaceNavLogoutBtn">
                Cerrar sesión
              </button>
              <button type="button" class="nav-toggle" id="navToggle" aria-label="Abrir menú" aria-expanded="false">
                <span></span>
                <span></span>
              </button>
            </div>
          </div>

          <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
            <nav class="mobile-menu__links">
              ${renderNavLinks(PRIVATE_NAV_ITEMS, true)}
            </nav>
            <div class="mobile-menu__actions">
              <div class="mobile-lang-row">${LANG_SWITCH_HTML}</div>
              <button type="button" class="btn btn--secondary btn--full" id="workspaceMobileLogoutBtn">Cerrar sesión</button>
            </div>
          </div>
        </header>
      `;

      const doLogout = () => {
        localStorage.removeItem("ckekea_auth_jwt_v1");
        localStorage.removeItem("ckekea_auth_user_v1");
        window.location.href = "login.html";
      };
      const b1 = document.getElementById("workspaceNavLogoutBtn");
      const b2 = document.getElementById("workspaceMobileLogoutBtn");
      if (b1) b1.addEventListener("click", doLogout);
      if (b2) b2.addEventListener("click", doLogout);
      return;
    }

    // MENÚ PÚBLICO (SIN DASHBOARD EN LA PÁGINA PRINCIPAL)
    mount.innerHTML = `
      <header class="navbar" id="navbar">
        <div class="container navbar__inner">
          <a href="index.html" class="brand" aria-label="${BASE.brand.name} Inicio">
            ${BRAND_LOCKUP_HTML}
          </a>

          <nav class="nav-links" aria-label="Navegación principal">
            ${renderNavLinks(PUBLIC_NAV_ITEMS, false)}
          </nav>

          <div class="navbar__actions">
            ${LANG_SWITCH_HTML}
            <a href="login.html" class="btn btn--ghost btn--sm" id="navLoginLink">
              Iniciar Sesión
            </a>
            <button type="button" class="btn btn--primary btn--sm" data-open-payment="pro">
              Contratar
            </button>
            <button type="button" class="nav-toggle" id="navToggle" aria-label="Abrir menú" aria-expanded="false">
              <span></span>
              <span></span>
            </button>
          </div>
        </div>

        <div class="mobile-menu" id="mobileMenu" aria-hidden="true">
          <nav class="mobile-menu__links">
            ${renderNavLinks(PUBLIC_NAV_ITEMS, true)}
          </nav>
          <div class="mobile-menu__actions">
            <div class="mobile-lang-row">${LANG_SWITCH_HTML}</div>
            <a href="login.html" class="btn btn--secondary btn--full" id="mobileLoginLink">Iniciar Sesión / Crear Cuenta</a>
            <button type="button" class="btn btn--primary btn--full" data-open-payment="pro">Contratar Plan</button>
          </div>
        </div>
      </header>
    `;
  }

  function injectFooter() {
    const mount = document.getElementById("siteFooter");
    if (!mount) return;

    if (isPrivateWorkspace) {
      mount.innerHTML = `
        <footer class="footer footer--workspace">
          <div class="container container--workspace">
            <div class="footer__bottom" style="padding-top:0;">
              <p>© <span id="footerYear">${BASE.brand.year}</span> ${BASE.brand.name} · Panel de Gestión.</p>
              <p><a href="index.html" style="color:var(--apple-blue);font-weight:500;">Ir a la web pública ›</a></p>
            </div>
          </div>
        </footer>
      `;
      return;
    }

    mount.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer__top">
            <div class="footer__brand">
              <img src="assets/sinkroo-logo.svg" alt="SINKR∞ — Automatización y Verificación al Momento" class="footer__logo-svg" />
              <p>Asistente de ventas con inteligencia artificial en WhatsApp, control de inventario y cobros automáticos para tu negocio.</p>
            </div>
            <div class="footer__cols">
              <div>
                <h4>Páginas</h4>
                <a href="index.html">Inicio</a>
                <a href="chatbot.html">Max IA</a>
                <a href="planes.html">Planes y Precios</a>
                <a href="api-studio.html">API Studio</a>
                <a href="fundadores.html">Equipo Fundador</a>
              </div>
              <div>
                <h4>Atención y Cuenta</h4>
                <span>Asistente Virtual: <strong>${BASE.bot.name} (${BASE.brand.name})</strong></span>
                <span>WhatsApp: <strong>${BASE.bot.whatsappNumberDisplay}</strong></span>
                <button type="button" class="footer__link-btn" data-open-whatsapp>Chatear con Max en WhatsApp ›</button>
                <a href="login.html" style="margin-top:8px;">Iniciar Sesión / Crear Cuenta ›</a>
              </div>
            </div>
          </div>
          <div class="footer__bottom">
            <p>© <span id="footerYear">${BASE.brand.year}</span> ${BASE.brand.name} Venezuela. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    `;
  }

  function injectDockAndModals() {
    const mount = document.getElementById("siteOverlays");
    if (!mount) return;

    const dockHtml = isPrivateWorkspace
      ? ""
      : `
      <!-- Dock flotante: WhatsApp Max (+584166214410) + Consola Rápida de Max -->
      <div class="floating-dock" aria-label="Accesos rápidos">
        <button type="button" class="dock-btn dock-btn--whatsapp" data-open-whatsapp aria-label="Contactar a Max por WhatsApp">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.33-1.66a11.87 11.87 0 0 0 5.71 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.42-8.42ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.91-9.89 2.65 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.45 9.89-9.9 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
          </svg>
          <span>Max WhatsApp</span>
        </button>

        <button type="button" class="dock-btn dock-btn--chat" id="floatingChatToggle" aria-label="Abrir Asistente Max">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      <!-- Ventana flotante del Bot Max -->
      <aside class="floating-chat" id="floatingChatDrawer" aria-hidden="true">
        <div class="chat-panel__header">
          <div class="chat-agent">
            <div class="chat-agent__avatar">M</div>
            <div>
              <strong>${BASE.bot.name} · ${BASE.brand.name}</strong>
              <span class="chat-agent__status"><span class="status-dot status-dot--green"></span>Asesor IA · ${BASE.bot.whatsappNumberDisplay}</span>
            </div>
          </div>
          <button type="button" class="modal-close modal-close--sm" id="floatingChatClose" aria-label="Cerrar chat">×</button>
        </div>
        <div class="chat-panel__messages" id="floatingChatMessages"></div>
        <div class="chat-quick-prompts chat-quick-prompts--compact">
          <button type="button" class="prompt-chip" data-prompt="1">1. Planes</button>
          <button type="button" class="prompt-chip" data-prompt="2">2. Demo venta</button>
          <button type="button" class="prompt-chip" data-prompt="3">3. Seguridad y ERP</button>
          <button type="button" class="prompt-chip" data-prompt="4">4. Diagnóstico</button>
        </div>
        <form class="chat-panel__form" id="floatingChatForm">
          <input type="text" id="floatingChatInput" class="chat-input" placeholder="Escribe 1, 2, 3, 4 o tu pregunta..." autocomplete="off" required />
          <button type="submit" class="btn btn--primary btn--icon" aria-label="Enviar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </aside>
    `;

    mount.innerHTML = `
      ${dockHtml}

      <!-- MODAL 1: PASARELA DE PAGO MÓVIL MERCANTIL -->
      <div class="modal-backdrop" id="paymentModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle">
        <div class="modal modal--wide modal--payment">
          <div class="modal-sheet-bar">
            <span class="modal-sheet-handle" aria-hidden="true"></span>
            <span class="modal-sheet-title">Pasarela Pago Móvil · Mercantil</span>
            <button type="button" class="modal-close" data-close-modal aria-label="Cerrar pasarela">×</button>
          </div>

          <div class="modal-scroll-body">
            <div id="paymentStepForm">
              <div class="modal__header">
                <span class="modal-kicker">Pasarela Oficial Venezuela · Pago Móvil</span>
                <h3 id="paymentModalTitle">Activa tu plan y recibe acceso a Max y tu API</h3>
                <p>Realiza tu Pago Móvil a Banco Mercantil y registra la referencia para emitir tu <code>X-API-Key</code> al instante.</p>
              </div>

              <div class="checkout-grid">
                <div class="mercantil-card">
                  <div class="mercantil-card__brand">
                    <div>
                      <span class="bank-tag">VENEZUELA · PAGO MÓVIL</span>
                      <h4>${BASE.payment.bankName} (${BASE.payment.bankCode})</h4>
                    </div>
                    <span class="verified-chip">Verificado</span>
                  </div>

                  <div class="copy-list">
                    <div class="copy-item">
                      <div>
                        <span>Banco</span>
                        <strong>${BASE.payment.bankCode} · Mercantil</strong>
                      </div>
                      <button type="button" class="copy-btn" data-copy-text="${BASE.payment.bankCode}">Copiar</button>
                    </div>
                    <div class="copy-item">
                      <div>
                        <span>Cédula de Identidad</span>
                        <strong id="pmCedulaText">${BASE.payment.cedulaFormatted}</strong>
                      </div>
                      <button type="button" class="copy-btn" data-copy-text="${BASE.payment.cedulaRaw}">Copiar</button>
                    </div>
                    <div class="copy-item">
                      <div>
                        <span>Teléfono Pago Móvil</span>
                        <strong id="pmPhoneText">${BASE.payment.phoneFormatted}</strong>
                      </div>
                      <button type="button" class="copy-btn" data-copy-text="${BASE.payment.phoneRaw}">Copiar</button>
                    </div>
                    <div class="copy-item copy-item--highlight">
                      <div>
                        <span>Monto a transferir</span>
                        <strong id="pmAmountSummary">$49 USD · Bs. 45.205,44</strong>
                        <small id="pmRateHint" style="display:block;font-size:0.72rem;color:#b8d7ff;margin-top:2px;">Tasa BCV del día</small>
                      </div>
                      <button type="button" class="copy-btn" id="copyBsAmountBtn">Copiar Bs</button>
                    </div>
                  </div>

                  <button type="button" class="btn btn--glass btn--full btn--sm" id="copyAllPaymentBtn">
                    Copiar todos los datos de Pago Móvil
                  </button>

                  <div class="mercantil-card__note">
                    <strong>Titular:</strong> ${BASE.payment.holderName} · País: ${BASE.payment.country}.<br />
                    Tras confirmar, se desbloquea tu acceso al Bot <strong>${BASE.bot.name}</strong> y tu <strong>API Key</strong>.
                  </div>
                </div>

                <form id="paymentCheckoutForm" class="checkout-form">
                  <div class="form-row-2">
                    <div class="field-light">
                      <label for="payPlanSelect">Plan seleccionado</label>
                      <select id="payPlanSelect" required>
                        <option value="estandar">Plan Estándar</option>
                        <option value="pro" selected>Plan Pro (Más popular)</option>
                        <option value="gold">Plan Gold (Empresarial)</option>
                      </select>
                    </div>
                    <div class="field-light">
                      <label for="payBusinessType">Rubro del negocio</label>
                      <select id="payBusinessType" required>
                        <option value="RETAIL">Comercio / Retail</option>
                        <option value="PHARMACY">Farmacia / Salud</option>
                        <option value="TECH">Tecnología / Electrónica</option>
                        <option value="HARDWARE">Ferretería / Repuestos</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row-2">
                    <div class="field-light">
                      <label for="payCustomerName">Nombre / Negocio</label>
                      <input type="text" id="payCustomerName" placeholder="Ej. Farmacia Central" required />
                    </div>
                    <div class="field-light">
                      <label for="payCustomerEmail">Correo electrónico</label>
                      <input type="email" id="payCustomerEmail" placeholder="tu@correo.com" required />
                    </div>
                  </div>

                  <div class="form-row-2">
                    <div class="field-light">
                      <label for="payOriginBank">Banco de origen</label>
                      <select id="payOriginBank" required>
                        <option value="Mercantil (0105)">Mercantil (0105)</option>
                        <option value="Banco de Venezuela (0102)">Banco de Venezuela (0102)</option>
                        <option value="Banesco (0134)">Banesco (0134)</option>
                        <option value="BBVA Provincial (0108)">BBVA Provincial (0108)</option>
                        <option value="BNC (0191)">BNC (0191)</option>
                        <option value="Bancamiga (0172)">Bancamiga (0172)</option>
                        <option value="Otro Banco Nacional">Otro Banco Nacional</option>
                      </select>
                    </div>
                    <div class="field-light">
                      <label for="payCustomerPhone">Tu teléfono WhatsApp</label>
                      <input type="tel" id="payCustomerPhone" placeholder="04141234567" required />
                    </div>
                  </div>

                  <div class="form-row-2">
                    <div class="field-light">
                      <label for="payReference">Referencia (6-8 dígitos)</label>
                      <input type="text" id="payReference" placeholder="Ej. 849201" minlength="4" maxlength="16" inputmode="numeric" required />
                    </div>
                    <div class="field-light">
                      <label for="payDate">Fecha del pago</label>
                      <input type="date" id="payDate" required />
                    </div>
                  </div>

                  <button type="submit" class="btn btn--primary btn--full btn--lg" id="confirmPaymentBtn">
                    Confirmar Pago y Desbloquear Bot + API
                  </button>
                </form>
              </div>
            </div>

            <div id="paymentStepSuccess" class="payment-success" hidden>
              <div class="success-icon" aria-hidden="true">✓</div>
              <span class="modal-kicker">Pago Registrado · Acceso Activado</span>
              <h3>¡Listo! Ya tienes acceso a Max y tu API</h3>
              <p id="successPlanDesc">Plan activado correctamente. Guarda tu llave en un lugar seguro.</p>

              <div class="generated-key-box">
                <span class="generated-key-box__label">TU NUEVA API KEY (X-API-Key)</span>
                <div class="generated-key-box__row">
                  <code id="freshApiKeyValue">sk_live_...</code>
                  <button type="button" class="btn btn--primary btn--sm" id="copyFreshKeyBtn">Copiar Key</button>
                </div>
                <small id="freshWebhookStatus">Registrada y lista para peticiones.</small>
              </div>

              <div class="payment-success__actions">
                <button type="button" class="btn btn--primary btn--lg" id="openUnlockedPortalBtn">
                  Abrir Portal Bot + API ›
                </button>
                <a href="#" target="_blank" rel="noopener noreferrer" class="btn btn--whatsapp btn--lg" id="sendReceiptWhatsappBtn">
                  Enviar comprobante a Max (${BASE.bot.whatsappNumberDisplay})
                </a>
                <button type="button" class="btn btn--secondary btn--lg" id="goToStudioKeysBtn">
                  Ver en API Studio
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 2: POP-UP DE FUNDADORES -->
      <div class="modal-backdrop" id="founderModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="founderModalName">
        <div class="modal modal--founder">
          <div class="modal-sheet-bar">
            <span class="modal-sheet-handle" aria-hidden="true"></span>
            <span class="modal-sheet-title">Equipo Fundador</span>
            <button type="button" class="modal-close" data-close-modal aria-label="Cerrar perfil">×</button>
          </div>
          <div class="modal-scroll-body">
            <div class="founder-modal__grid">
              <div class="founder-modal__photo-wrap">
                <img id="founderModalImg" src="" alt="" class="founder-modal__photo" />
              </div>
              <div class="founder-modal__body">
                <span class="modal-kicker" id="founderModalRole">Rol</span>
                <h3 id="founderModalName">Nombre</h3>
                <p class="founder-modal__summary" id="founderModalSummary"></p>
                <p class="founder-modal__bio" id="founderModalBio"></p>
                <div class="founder-modal__tags" id="founderModalTags"></div>
                <div class="founder-modal__actions">
                  <a href="#" target="_blank" rel="noopener noreferrer" class="btn btn--whatsapp btn--full" id="founderWhatsappBtn">
                    Contactar por WhatsApp (${BASE.bot.whatsappNumberDisplay})
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL 3: POP-UP WHATSAPP -->
      <div class="modal-backdrop" id="whatsappModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="whatsappModalTitle">
        <div class="modal modal--compact">
          <div class="modal-sheet-bar">
            <span class="modal-sheet-handle" aria-hidden="true"></span>
            <span class="modal-sheet-title">WhatsApp Oficial ${BASE.brand.name}</span>
            <button type="button" class="modal-close" data-close-modal aria-label="Cerrar contacto WhatsApp">×</button>
          </div>
          <div class="modal-scroll-body">
            <div class="wa-header">
              <div class="wa-badge-icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.33-1.66a11.87 11.87 0 0 0 5.71 1.46h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.42-8.42ZM12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.86 9.86 0 0 1-1.51-5.25c0-5.45 4.44-9.89 9.91-9.89 2.65 0 5.13 1.03 7 2.9a9.84 9.84 0 0 1 2.9 7c0 5.46-4.45 9.89-9.9 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"/>
                </svg>
              </div>
              <span class="modal-kicker">Bot Oficial ${BASE.bot.name} · ${BASE.brand.name}</span>
              <h3 id="whatsappModalTitle">Chatea con ${BASE.bot.name} por WhatsApp</h3>
              <p>Conecta directo con el Bot <strong>${BASE.bot.name}</strong> al <strong>${BASE.bot.whatsappNumberDisplay}</strong> o con nuestro equipo de pagos al <strong>${BASE.payment.phoneFormatted}</strong>.</p>
            </div>

            <div class="wa-channel-switch" role="group" aria-label="Canal de WhatsApp">
              <button type="button" class="wa-channel-btn is-active" data-wa-channel="${BASE.bot.whatsappNumberRaw}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Bot ${BASE.bot.name} (${BASE.bot.whatsappNumberDisplay})
              </button>
              <button type="button" class="wa-channel-btn" data-wa-channel="${BASE.payment.whatsappSupportRaw}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                Pagos / Equipo (${BASE.payment.phoneFormatted})
              </button>
            </div>

            <div class="wa-topics" id="waTopics">
              <button type="button" class="wa-topic is-active" data-wa-msg="Hola Max de SINKR∞, quiero ver los planes Estándar, Pro y Gold.">1. Ver Planes</button>
              <button type="button" class="wa-topic" data-wa-msg="Hola Max, quiero probar la demo interactiva de venta.">2. Demo de Venta</button>
              <button type="button" class="wa-topic" data-wa-msg="Hola Max, quiero integrar SINKR∞ con mi sistema ERP (Saint / Profit / A2 / Valery).">3. Seguridad y ERP</button>
              <button type="button" class="wa-topic" data-wa-msg="Hola Max, quiero hacer el diagnóstico rápido para mi negocio.">4. Diagnóstico Rápido</button>
              <button type="button" class="wa-topic" data-wa-msg="Hola equipo SINKR∞, ya realicé mi Pago Móvil a Mercantil (0424-6003606) y quiero validar mi referencia.">Enviar Comprobante</button>
            </div>

            <form id="whatsappDirectForm" class="wa-form">
              <div class="field-light">
                <label for="waCustomMessage">Tu mensaje para WhatsApp</label>
                <textarea id="waCustomMessage" rows="3" required>Hola Max de SINKR∞, quiero ver los planes Estándar, Pro y Gold.</textarea>
              </div>
              <button type="submit" class="btn btn--whatsapp btn--full btn--lg" id="waSubmitBtn">
                Abrir WhatsApp con Max (${BASE.bot.whatsappNumberDisplay})
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- MODAL 4: ACCESO CON API KEY EXISTENTE -->
      <div class="modal-backdrop" id="unlockAccessModal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="unlockAccessTitle">
        <div class="modal modal--compact">
          <div class="modal-sheet-bar">
            <span class="modal-sheet-handle" aria-hidden="true"></span>
            <span class="modal-sheet-title">Acceso Clientes ${BASE.brand.name}</span>
            <button type="button" class="modal-close" data-close-modal aria-label="Cerrar acceso">×</button>
          </div>
          <div class="modal-scroll-body">
            <div class="modal__header">
              <span class="modal-kicker">Acceso Clientes ${BASE.brand.name}</span>
              <h3 id="unlockAccessTitle">Desbloquea tu Bot y API</h3>
              <p>Si ya pagaste tu plan o recibiste tu llave <code>sk_live_...</code>, ingrésala aquí para habilitar la consola de Max y el Bot Comercial.</p>
            </div>
            <form id="unlockAccessForm" class="wa-form">
              <div class="field-light">
                <label for="unlockApiKeyInput">Tu API Key (X-API-Key)</label>
                <input type="text" id="unlockApiKeyInput" placeholder="sk_live_..." required />
              </div>
              <div class="form-row-2">
                <div class="field-light">
                  <label for="unlockNameInput">Nombre o Negocio</label>
                  <input type="text" id="unlockNameInput" placeholder="Mi Negocio" required />
                </div>
                <div class="field-light">
                  <label for="unlockPlanInput">Plan</label>
                  <select id="unlockPlanInput">
                    <option value="ESTANDAR">Estándar</option>
                    <option value="PRO" selected>Pro</option>
                    <option value="GOLD">Gold</option>
                  </select>
                </div>
              </div>
              <button type="submit" class="btn btn--primary btn--full btn--lg">Activar acceso al Bot y API</button>
            </form>
          </div>
        </div>
      </div>

      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    `;
  }

  const EYE_OPEN_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  function enhancePasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach((input) => {
      if (input.dataset.eyeEnhanced === "1") return;
      input.dataset.eyeEnhanced = "1";

      const wrap = document.createElement("div");
      wrap.className = "password-wrap";
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "password-eye-btn";
      btn.setAttribute("aria-label", "Mostrar contraseña");
      btn.innerHTML = EYE_OPEN_SVG;

      btn.addEventListener("click", () => {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.innerHTML = show ? EYE_OFF_SVG : EYE_OPEN_SVG;
        btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
      });

      wrap.appendChild(btn);
    });
  }

  injectHeader();
  injectFooter();
  injectDockAndModals();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhancePasswordToggles);
  } else {
    enhancePasswordToggles();
  }
})();
