/**
 * ============================================================================
 * SINKR∞ — MOTOR MULTI-IDIOMA INSTANTÁNEO (ESPAÑOL / ENGLISH)
 * ============================================================================
 * Traduce la interfaz completa entre Español (es) e Inglés (en) sin recargar,
 * conservando siempre el texto original en español para alternar sin pérdida.
 */

(function () {
  "use strict";

  const LANG_KEY = "sinkroo_lang_v1";

  const DICT_EN = {
    // Títulos de página
    "SINKR∞ — Max IA, Automatización y Verificación al Momento": "SINKR∞ — Max AI, Automation & Instant Verification",
    "Planes Estándar, Pro y Gold — SINKR∞": "Standard, Pro & Gold Plans — SINKR∞",
    "Max IA & Portal Bot + API — SINKR∞": "Max AI & Bot Portal + API — SINKR∞",
    "API Studio & Webhooks — SINKR∞": "API Studio & Webhooks — SINKR∞",
    "Equipo Fundador & Contacto — SINKR∞": "Founding Team & Contact — SINKR∞",
    "Iniciar Sesión / Registro — SINKR∞": "Sign In / Sign Up — SINKR∞",
    "Mi Dashboard — SINKR∞": "My Dashboard — SINKR∞",
    "Panel Superadmin — SINKR∞": "Superadmin Panel — SINKR∞",

    // Navegación pública y privada
    "Inicio": "Home",
    "Max IA": "Max AI",
    "Planes": "Plans",
    "Planes Estándar, Pro y Gold": "Standard, Pro & Gold Plans",
    "API Studio": "API Studio",
    "Fundadores": "Founders",
    "Iniciar Sesión": "Sign In",
    "Mi Cuenta": "My Account",
    "Ir a Mi Cuenta": "Go to My Account",
    "Contratar": "Get Started",
    "Contratar Plan": "Choose a Plan",
    "Iniciar Sesión / Crear Cuenta": "Sign In / Create Account",
    "Dashboard Principal": "Main Dashboard",
    "Panel Admin": "Admin Panel",
    "Cerrar sesión": "Sign Out",
    "Ir a la web pública ›": "Go to public site ›",
    "Páginas": "Pages",
    "Planes y Precios": "Plans & Pricing",
    "Equipo Fundador": "Founding Team",
    "Atención y Cuenta": "Support & Account",
    "Asistente Virtual:": "Virtual Assistant:",
    "Chatear con Max en WhatsApp ›": "Chat with Max on WhatsApp ›",
    "Iniciar Sesión / Crear Cuenta ›": "Sign In / Create Account ›",
    "Asistente de ventas con inteligencia artificial en WhatsApp, control de inventario y cobros automáticos para tu negocio.": "AI sales assistant on WhatsApp, inventory control, and instant payment verification for your business.",
    "© 2026 SINKR∞ Venezuela. Todos los derechos reservados.": "© 2026 SINKR∞ Venezuela. All rights reserved.",

    // Hero index.html
    "SINKR∞ · Automatización y verificación al momento": "SINKR∞ · Automation & instant verification",
    "Tu comercio vende 24/7.": "Your business sells 24/7.",
    "Max atiende, valida y escala.": "Max assists, verifies, and scales.",
    "Asistente virtual en WhatsApp, panel web": "Virtual assistant on WhatsApp, web dashboard",
    ", validación automática de Pago Móvil y conexión directa con": ", automatic Pago Móvil verification, and direct sync with",
    "Explorar Planes": "Explore Plans",
    "Hablar con Max en vivo": "Chat with Max Live",
    "Bot Max · Activo 24/7": "Bot Max · Active 24/7",
    "Atiende clientes al instante en WhatsApp": "Replies to customers instantly on WhatsApp",
    "Pagos Verificados": "Verified Payments",
    "Pago Móvil + Control de Inventario": "Mobile Payment + Inventory Control",
    "Pausar": "Pause",
    "Reproducir": "Play",
    "Sonido": "Sound",
    "Silenciar": "Mute",

    // Carrusel index.html
    "Ecosistema SINKR∞": "SINKR∞ Ecosystem",
    "Todo lo que tu negocio necesita.": "Everything your business needs.",
    "Simple, rápido y automático.": "Simple, fast, and automated.",
    "Bot Max · IA 24/7": "Bot Max · 24/7 AI",
    "Asesor de ventas humano en WhatsApp.": "Human-like sales advisor on WhatsApp.",
    "Atiende dudas, muestra precios reales de tu catálogo, lee fotos de récipes o comprobantes y cierra ventas sin hacer esperar al cliente.": "Answers questions, shows live catalog prices, reads prescriptions or payment receipts, and closes sales without keeping customers waiting.",
    "¿Tienes disponible el Combo Emprendedor?": "Is the Starter Bundle available?",
    "¡Sí! Disponible hoy por $25. ¿Cuántas unidades deseas apartar?": "Yes! Available today for $25. How many units would you like to reserve?",
    "Validación Anti-Fraude": "Anti-Fraud Verification",
    "Confirma cada Pago Móvil en segundos.": "Verify every Pago Móvil in seconds.",
    "Verifica automáticamente cada referencia bancaria para evitar capturas falsas y liberar a tu equipo de revisar pagos manualmente.": "Automatically validates every bank reference to eliminate fake edited screenshots and save your team hours of manual checking.",
    "1. Comprobante recibido": "1. Receipt received",
    "Al instante": "Instantly",
    "2. Verificación bancaria": "2. Bank verification",
    "Automática": "Automatic",
    "3. Estado del pedido": "3. Order status",
    "Aprobado": "Approved",
    "SINKR∞ App + Reportes": "SINKR∞ App + Reports",
    "Control total de stock y cierre semanal.": "Full stock control & weekly summary.",
    "Actualiza precios, recibe alertas de pedidos en vivo y obtén tu reporte semanal de ventas en PDF directo en tu WhatsApp.": "Update prices, get live order alerts, and receive your weekly sales PDF report directly on WhatsApp.",
    "REPORTE SEMANAL EN PDF": "WEEKLY PDF REPORT",
    "Resumen claro de tus ventas, pedidos cobrados y movimientos cada semana.": "Clear summary of your sales, verified payments, and activity every week.",
    "Conexión Administrativa · Plan Gold": "ERP Integration · Gold Plan",
    "Sincroniza automáticamente tu inventario, precios y facturación con el sistema administrativo que ya usas en tu empresa.": "Automatically sync your inventory, prices, and invoicing with the ERP software your company already uses.",
    "Inventario sincronizado en tiempo real": "Real-time inventory sync",
    "Precios siempre al día en WhatsApp": "Always up-to-date prices on WhatsApp",
    "Pedidos conectados con tu facturación": "Orders connected to your invoicing",

    // Hub Cards index.html
    "Explora cada módulo": "Explore each module",
    "Todo organizado para tu negocio.": "Everything organized for your business.",
    "Prueba a Max en vivo, elige tu plan con tasa BCV actualizada, conecta tu sistema o conoce al equipo detrás de SINKR∞.": "Test Max live, pick a plan with live exchange rates, connect your system, or meet the team behind SINKR∞.",
    "Asistente Virtual": "Virtual Assistant",
    "Conversa con Max en vivo": "Chat with Max live",
    "Prueba cómo Max atiende a tus clientes, responde preguntas sobre productos, hace demos de venta y te recomienda el mejor plan.": "See how Max helps customers, answers product questions, runs sales demos, and recommends the best plan.",
    "Probar a Max ahora ›": "Try Max now ›",
    "Compara funciones, mira el precio actualizado en bolívares a tasa BCV del día y activa tu plan en minutos por Pago Móvil.": "Compare features, check live VES pricing at today's BCV rate, and activate your plan in minutes via Pago Móvil.",
    "Ver Planes y Precios ›": "View Plans & Pricing ›",
    "Integraciones": "Integrations",
    "API Studio & Llaves de Acceso": "API Studio & Access Keys",
    "Conecta tu página web o sistema propio con SINKR∞ usando tu llave API en pocos pasos, sin complicaciones.": "Connect your website or internal software to SINKR∞ with your API key in just a few simple steps.",
    "Abrir API Studio ›": "Open API Studio ›",
    "Nuestro Equipo": "Our Team",
    "Equipo Fundador & Contacto": "Founding Team & Contact",
    "Conoce a Fidel Pereira (Fundador), Jesús Romero (CEO) y José Davalillo (Ingeniero de Software) y escríbenos cuando lo necesites.": "Meet Fidel Pereira (Founder), Jesús Romero (CEO), and José Davalillo (Software Engineer) and reach out anytime.",
    "Conocer a los Fundadores ›": "Meet the Founders ›",

    // 3 pasos simples & CTA final
    "Fácil de activar": "Easy to launch",
    "Empieza a vender en 3 pasos simples.": "Start selling in 3 simple steps.",
    "Sin instalaciones complicadas ni conocimientos técnicos. En minutos tu negocio ya está atendiendo 24/7.": "No complex setup or technical background required. In minutes your store is selling 24/7.",
    "Elige tu plan": "Choose your plan",
    "Activa Estándar, Pro o Gold pagando por Pago Móvil con el monto calculado automáticamente a tasa BCV del día.": "Activate Standard, Pro, or Gold via Pago Móvil with amounts calculated automatically at today's official rate.",
    "Carga tu inventario": "Upload your inventory",
    "Sube tus productos y precios desde tu panel en segundos y vincula tu WhatsApp escaneando un código QR.": "Upload your products and prices from your dashboard in seconds and link WhatsApp by scanning a QR code.",
    "Max vende por ti 24/7": "Max sells for you 24/7",
    "Responde clientes al instante, verifica pagos automáticamente y te envía tu cierre semanal directo a tu teléfono.": "Replies to customers instantly, verifies payments automatically, and sends your weekly report straight to your phone.",
    "Empieza hoy con SINKR∞": "Start today with SINKR∞",
    "Activa tu asistente de ventas hoy mismo.": "Activate your AI sales assistant today.",
    "Automatiza tu WhatsApp, valida tus pagos y controla tu inventario desde un solo lugar.": "Automate WhatsApp, verify payments, and manage inventory all from one place.",
    "Ver Planes": "View Plans",
    "Probar a Max ahora": "Try Max Now",

    // Planes (planes.html + cards dinámicas)
    "Tasa BCV en tiempo real · Pago Móvil Venezuela · Activación inmediata": "Live BCV Exchange Rate · Pago Móvil Venezuela · Instant Activation",
    "Elige el plan ideal": "Choose the ideal plan",
    "para escalar tus ventas.": "to scale your sales.",
    "Desde comercios que quieren automatizar WhatsApp con": "From local stores automating WhatsApp with",
    "hasta cadenas multi-sucursal conectadas con": "to multi-branch businesses integrated with",
    "Mensual": "Monthly",
    "Anual": "Annual",
    "Tasa BCV hoy:": "Live BCV rate:",
    "Plan Estándar": "Standard Plan",
    "Plan Pro": "Pro Plan",
    "Plan Gold": "Gold Plan",
    "Esencial": "Essential",
    "Más popular": "Most Popular",
    "Empresarial": "Enterprise",
    "Pagar y Activar Plan Estándar": "Activate Standard Plan",
    "Pagar y Activar Plan Pro": "Activate Pro Plan",
    "Pagar y Activar Plan Gold": "Activate Gold Plan",
    "Comparativa de planes": "Plan comparison",
    "Beneficio": "Feature",
    "Estándar": "Standard",
    "Asistente IA 24/7 en WhatsApp (Max / Marca Blanca)": "24/7 AI Assistant on WhatsApp (Max / White-Label)",
    "Panel web SINKR∞ App (catálogo, pedidos, stock y alertas)": "SINKR∞ App web panel (catalog, orders, stock & alerts)",
    "Reporte PDF de Cierre Semanal de Ventas": "Weekly Sales Summary PDF Report",
    "Validación automática de Pago Móvil (anti-fraude)": "Automatic Pago Móvil verification (anti-fraud)",
    "Lectura inteligente de récipes y comprobantes": "Smart reading of prescriptions & payment receipts",
    "Conexión con sistemas administrativos (Saint, Profit, A2, Valery, Premium Soft)": "ERP integration (Saint, Profit, A2, Valery, Premium Soft)",
    "Soporte y respaldo en la nube 24/7": "24/7 cloud backup & support",
    "✓ Incluido": "✓ Included",
    "✓ Multi-sucursal": "✓ Multi-branch",
    "✓ En panel web": "✓ Web dashboard",
    "✓ Automático programado": "✓ Scheduled automatic",
    "Validación en caja": "Manual check",
    "✓ Automática en segundos": "✓ Automatic in seconds",
    "✓ Automática prioritaria": "✓ Priority automatic",
    "Básica": "Basic",
    "✓ Completa": "✓ Full",
    "✓ Completa + Prioridad": "✓ Full + Priority",
    "Sincronización de stock": "Stock sync",
    "✓ Conexión completa": "✓ Full two-way sync",
    "✓ Prioritario": "✓ Priority",
    "✓ Dedicado": "✓ Dedicated",
    "Tasa Oficial": "Official Rate",
    "Precio BCV actualizado": "Live BCV Pricing",
    "El monto en bolívares se calcula automáticamente al contratar": "VES amount is automatically calculated at checkout",
    "Activación Inmediata": "Instant Activation",
    "Acceso al instante": "Immediate Access",
    "Asesoría Directa": "Direct Support",
    "Max en WhatsApp": "Max on WhatsApp",
    "+58 416-6214410 · Diagnóstico gratuito": "+58 416-6214410 · Free assessment",
    "¿No sabes qué plan elegir?": "Not sure which plan to pick?",
    "Haz el Diagnóstico Rápido con Max ›": "Take the Quick Assessment with Max ›",
    "Arquitectura técnica": "Technical tools",
    "Explorar API Studio y Endpoints ›": "Explore API Studio & Endpoints ›",
    "Respaldo humano": "Real team",
    "Conoce a los Fundadores ›": "Meet the Founders ›",

    // Chatbot (chatbot.html)
    "Asistente Virtual Max · Disponible 24/7 en WhatsApp": "Max Virtual Assistant · Available 24/7 on WhatsApp",
    "Conversa con Max": "Chat with Max",
    "y pruébalo en vivo.": "and test it live.",
    "Prueba ahora mismo cómo": "Try right now how",
    "atiende a tus clientes, responde dudas, hace demos de venta y recomienda el plan ideal para tu comercio.": "helps your customers, answers questions, runs sales demos, and recommends the right plan for your store.",
    "Contratar un Plan": "Choose a Plan",
    "Ya tengo mi API Key": "I already have an API Key",
    "Pagar y Desbloquear": "Pay & Unlock",
    "Flujo comercial real integrado en la web": "Real sales workflow live on the web",
    "Respuestas al instante": "Instant replies",
    "Fotos": "Photos",
    "Lee récipes y pagos": "Reads receipts & notes",
    "Conexión con QR": "QR pairing",
    "Reiniciar": "Reset",
    "Activar Plan": "Activate Plan",
    "1. Planes": "1. Plans",
    "2. Demo de venta": "2. Sales Demo",
    "2. Demo venta": "2. Sales Demo",
    "3. Seguridad y ERP": "3. Security & ERP",
    "4. Diagnóstico rápido": "4. Quick Assessment",
    "4. Diagnóstico": "4. Assessment",
    "Pasar a WhatsApp": "Switch to WhatsApp",
    "Escribe 1, 2, 3, 4 o conversa con Max...": "Type 1, 2, 3, 4 or chat with Max...",
    "Escribe 1, 2, 3, 4 o tu pregunta...": "Type 1, 2, 3, 4 or ask a question...",

    // API Studio (api-studio.html)
    "Centro de Integraciones · API Keys y Conexión de Sistemas": "Integrations Hub · API Keys & System Connections",
    "Conecta tu sistema con SINKR∞.": "Connect your system with SINKR∞.",
    "Espacio pensado para empresas y desarrolladores que desean enlazar su tienda web, aplicación o sistema administrativo con Max usando llaves de acceso seguras.": "Built for companies and developers who want to connect their website, app, or ERP software with Max using secure API keys.",
    "Descargar configuración": "Download config",
    "Activar Plan y API Key": "Activate Plan & API Key",
    "Probar a Max ›": "Try Max ›",
    "1. Conectar Backends & Bot": "1. Connect Backends & Bot",
    "2. Subir Especificación (.json)": "2. Upload Spec (.json)",
    "3. API Keys Generadas": "3. Generated API Keys",
    "4. Código de Integración": "4. Integration Code",
    "Guardar configuración": "Save configuration",
    "Probar /health en ambos": "Test /health on both",
    "Seleccionar archivo JSON": "Select JSON file",
    "Exportar JSON": "Export JSON",
    "+ Generar Key de prueba": "+ Generate test Key",
    "Copiar": "Copy",

    // Fundadores (fundadores.html)
    "Liderazgo & Ingeniería SINKR∞ · Venezuela": "SINKR∞ Leadership & Engineering · Venezuela",
    "Las mentes detrás": "The minds behind",
    "de Max y SINKR∞.": "Max and SINKR∞.",
    "Haz clic en cada integrante para abrir su pop-up detallado con el resumen de su rol y contactarnos directamente por WhatsApp.": "Click any team member to view their role summary and reach out directly via WhatsApp.",
    "Bot Oficial WhatsApp": "Official WhatsApp Bot",
    "Habla ahora con Max": "Talk to Max now",
    "Atención automatizada 24/7 para ver planes, probar la demo interactiva de venta y realizar tu diagnóstico rápido.": "24/7 automated assistance to explore plans, try the interactive sales demo, and run your quick assessment.",
    "Escribir a Max (+58 416-6214410)": "Message Max (+58 416-6214410)",
    "Pagos & Administración": "Payments & Billing",
    "Pago Móvil Mercantil Venezuela": "Pago Móvil Mercantil Venezuela",
    "Activa tu plan Estándar, Pro o Gold y desbloquea al instante el acceso a tu API Key y Bot Comercial.": "Activate your Standard, Pro, or Gold plan and instantly unlock your API Key and Sales Bot.",
    "Abrir Pasarela de Pago Móvil": "Open Payment Gateway",

    // Login (login.html)
    "Tu propio Dashboard para controlar el Bot y tu inventario.": "Your own Dashboard to control your Bot and inventory.",
    "Crear Cuenta": "Create Account",
    "Correo electrónico": "Email address",
    "Contraseña": "Password",
    "Entrar a mi Dashboard": "Enter my Dashboard",
    "¿Aún no tienes cuenta?": "Don't have an account yet?",
    "Regístrate gratis aquí": "Sign up free here",
    "Tu nombre": "Your name",
    "Nombre de tu negocio": "Business name",
    "Rubro del negocio": "Business category",
    "Plan inicial": "Starting plan",
    "WhatsApp del negocio": "Business WhatsApp",
    "Contraseña (mín. 6 caracteres)": "Password (min. 6 characters)",
    "Repetir contraseña": "Confirm password",
    "Crear cuenta y abrir Dashboard": "Create account & open Dashboard",

    // Modales
    "Pasarela Oficial Venezuela · Pago Móvil": "Official Venezuela Gateway · Pago Móvil",
    "Activa tu plan y recibe acceso a Max y tu API": "Activate your plan and unlock Max & your API",
    "Realiza tu Pago Móvil a Banco Mercantil y registra la referencia para emitir tu": "Send your Pago Móvil to Banco Mercantil and submit the reference to issue your",
    "Banco": "Bank",
    "Cédula de Identidad": "National ID (C.I.)",
    "Teléfono Pago Móvil": "Pago Móvil Phone",
    "Monto a transferir": "Amount to transfer",
    "Copiar Bs": "Copy VES",
    "Copiar todos los datos de Pago Móvil": "Copy all Pago Móvil details",
    "Plan seleccionado": "Selected plan",
    "Nombre / Negocio": "Name / Business",
    "Banco de origen": "Sender bank",
    "Tu teléfono WhatsApp": "Your WhatsApp phone",
    "Referencia (6-8 dígitos)": "Reference (6-8 digits)",
    "Fecha del pago": "Payment date",
    "Confirmar Pago y Desbloquear Bot + API": "Confirm Payment & Unlock Bot + API",
    "Verificado": "Verified",
    "Chatea con Max por WhatsApp": "Chat with Max on WhatsApp",
    "Tu mensaje para WhatsApp": "Your WhatsApp message",
    "Abrir WhatsApp con Max (+58 416-6214410)": "Open WhatsApp with Max (+58 416-6214410)",
    "Max WhatsApp": "Max WhatsApp",

    // Dashboard y Admin principales
    "Panel Superadmin": "Superadmin Panel",
    "Apagar Bot": "Turn Bot Off",
    "Encender Bot": "Turn Bot On",
    "Reiniciar WhatsApp": "Restart WhatsApp",
    "Productos en Inventario": "Products in Inventory",
    "Unidades Totales en Stock": "Total Stock Units",
    "Estado WhatsApp / Bot": "WhatsApp / Bot Status",
    "Tu API Key Activa": "Your Active API Key",
    "Vincular WhatsApp por QR o Código": "Link WhatsApp via QR or Code",
    "Configuración de tu Negocio": "Business Settings",
    "Sube tu Inventario para que el Bot lo asimile": "Upload your Inventory for the Bot",
    "API Bancaria de tu Bot": "Your Bot's Bank API",
    "Cambiar mi Contraseña": "Change my Password",
    "Consola Global Superadmin": "Global Superadmin Console",
    "Mi Dashboard de Usuario": "My User Dashboard",
    "Actualizar": "Refresh",
    "Consumo de API y Chatbot por Empresa": "API & Chatbot Usage per Company",
    "Actividad Diaria y Distribución": "Daily Activity & Distribution",
    "Crear Usuario Común": "Create Standard User",
    "Crear Superusuario": "Create Superuser",
    "Empresas, Roles, Bots y Consumo": "Companies, Roles, Bots & Usage"
  };

  let currentLang = "es";
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "es") currentLang = saved;
  } catch {
    currentLang = "es";
  }

  let originalTitleEs = document.title;
  let isApplying = false;

  function translateString(raw, lang) {
    if (lang !== "en") return raw;
    const trimmed = String(raw || "").trim();
    if (!trimmed) return raw;
    if (Object.prototype.hasOwnProperty.call(DICT_EN, trimmed)) {
      const lead = raw.slice(0, raw.indexOf(trimmed));
      const trail = raw.slice(raw.indexOf(trimmed) + trimmed.length);
      return lead + DICT_EN[trimmed] + trail;
    }
    // Patrones dinámicos frecuentes (tasa, precios en Bs, botones de plan)
    if (trimmed.indexOf("≈ Bs.") === 0) {
      return raw.replace("vía Pago Móvil Mercantil", "via Pago Móvil Mercantil");
    }
    if (trimmed.indexOf("USD / mes") !== -1) {
      return raw.replace("/ mes (anual)", "/ mo (annual)").replace("/ mes", "/ mo");
    }
    if (trimmed.indexOf("Tasa BCV:") === 0) {
      return raw.replace("Tasa BCV:", "BCV Rate:");
    }
    return raw;
  }

  function applyTextNodes(root, lang) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "CODE" || tag === "PRE" || tag === "NOSCRIPT") {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue && node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (typeof node._origEs === "undefined") {
        node._origEs = node.nodeValue;
      }
      const nextVal = lang === "en" ? translateString(node._origEs, "en") : node._origEs;
      if (node.nodeValue !== nextVal) {
        node.nodeValue = nextVal;
      }
    }

    // Placeholders
    const inputs = root.querySelectorAll ? root.querySelectorAll("input[placeholder], textarea[placeholder]") : [];
    inputs.forEach((el) => {
      if (typeof el.dataset.origPlaceholderEs === "undefined") {
        el.dataset.origPlaceholderEs = el.getAttribute("placeholder") || "";
      }
      const orig = el.dataset.origPlaceholderEs;
      const next = lang === "en" ? translateString(orig, "en") : orig;
      if (el.getAttribute("placeholder") !== next) {
        el.setAttribute("placeholder", next);
      }
    });
  }

  function updateButtons() {
    document.querySelectorAll("[data-set-lang]").forEach((btn) => {
      const active = btn.getAttribute("data-set-lang") === currentLang;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function applyLanguage(lang) {
    if (isApplying) return;
    isApplying = true;
    try {
      currentLang = lang === "en" ? "en" : "es";
      try {
        localStorage.setItem(LANG_KEY, currentLang);
      } catch {
        // silencioso
      }
      document.documentElement.lang = currentLang;
      document.title = currentLang === "en" ? translateString(originalTitleEs, "en") : originalTitleEs;
      applyTextNodes(document.body, currentLang);
      updateButtons();
    } finally {
      isApplying = false;
    }
  }

  function setLang(lang) {
    applyLanguage(lang);
    window.dispatchEvent(new CustomEvent("sinkroo:langchange", { detail: { lang: currentLang } }));
  }

  function getLang() {
    return currentLang;
  }

  window.SINKROO_I18N = {
    getLang: getLang,
    setLang: setLang,
    applyLanguage: function () {
      applyLanguage(currentLang);
    },
    t: function (esText) {
      return currentLang === "en" ? translateString(esText, "en") : esText;
    }
  };

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set-lang]");
    if (!btn) return;
    setLang(btn.getAttribute("data-set-lang"));
  });

  function initI18n() {
    originalTitleEs = document.title;
    applyLanguage(currentLang);

    // Observar contenido renderizado dinámicamente (planes, modales, fundadores)
    let raf = null;
    const observer = new MutationObserver(() => {
      if (currentLang !== "en" || isApplying) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        applyLanguage(currentLang);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initI18n);
  } else {
    initI18n();
  }
})();
