/**
 * ============================================================================
 * SINKR∞ — CONFIGURACIÓN CENTRAL (AUTOMATIZACIÓN Y VERIFICACIÓN AL MOMENTO)
 * ============================================================================
 */

window.SINKROO_CONFIG = window.CHEKEA_CONFIG = {
  brand: {
    name: "SINKR∞",
    plainName: "SINKROO",
    appName: "SINKR∞ App",
    botName: "Max",
    tagline: "Automatización y verificación al momento.",
    email: "contacto@sinkroo.io",
    country: "Venezuela",
    year: 2026
  },

  // Datos oficiales del Bot Max en WhatsApp
  bot: {
    name: "Max",
    companyName: "SINKR∞",
    appName: "SINKR∞ App",
    whatsappEnabled: true,
    whatsappNumberRaw: "584166214410",
    whatsappNumberDisplay: "+58 416-6214410",
    whatsappNumberEnv: "+584166214410",
    whatsappSessionPath: ".wwebjs_auth",
    defaultGreeting:
      "Hola Max de SINKR∞, vengo desde la página web y quiero conocer los planes y ver una demo."
  },

  // URL del servidor propio independiente (server/server.js en Railway o localhost)
  platform: {
    apiBaseUrl: ""
  },

  // Datos oficiales de Pago Móvil (Venezuela - Banco Mercantil) y WhatsApp de soporte/pagos
  payment: {
    country: "Venezuela",
    bankName: "Banco Mercantil",
    bankCode: "0105",
    cedulaRaw: "31091406",
    cedulaFormatted: "V-31.091.406",
    phoneRaw: "04246003606",
    phoneFormatted: "0424-6003606",
    whatsappSupportRaw: "584246003606",
    whatsappInternational: "584166214410",
    holderName: "José Davalillo",
    exchangeRateBs: 926.36,
    annualDiscountPercent: 20
  },

  // Rutas de medios y logos SVG
  media: {
    heroShowcase: "assets/hero-showcase.jpg",
    heroVideo: "assets/sinkroo-hero.mp4",
    aiArchitecture: "assets/ai-architecture.jpg",
    logoIconSvg: "assets/sinkroo-icon.svg",
    logoFullSvg: "assets/sinkroo-logo.svg",
    logoFullDarkSvg: "assets/sinkroo-logo-dark.svg"
  },

  // Seguridad ISO/IEC 27001:2022 & OWASP API Top 10 (de SECURITY_ISO27001.md)
  security: [
    {
      code: "ISO A.5.15 / OWASP API2",
      title: "Autenticación con tiempo constante",
      desc: "Tokens X-API-Key y X-Panel-Token validados con crypto.timingSafeEqual y firmas HMAC-SHA256."
    },
    {
      code: "ISO A.8.20 / OWASP API4",
      title: "Rate Limiting inteligente",
      desc: "Protección activa contra abuso (180 req/min API REST, 120 req/min API SaaS, 60 req/min Webhooks)."
    },
    {
      code: "ISO A.8.26 / OWASP A03",
      title: "Cero XSS y validación Zod",
      desc: "Sanitización estricta en paneles web, validación de esquemas Zod y cabeceras Helmet defensivas."
    },
    {
      code: "API Bancaria Anti-Fraude",
      title: "Validación real de Pago Móvil",
      desc: "Verificación directa contra el banco en segundos para erradicar capturas falsas editadas."
    }
  ],

  // Planes reales de Ckekea (Estándar, Pro y Gold)
  // Nota técnica: Prisma `enum PlanType` usa `LITE | PRO` en standalone-chatbot-api.ts,
  // mientras client-sales-bot.ts usa `ESTANDAR | PRO | GOLD`. Aquí mapeamos ambos exactamente.
  plans: [
    {
      id: "estandar",
      apiPlanEnum: "LITE",
      clientBotPlan: "ESTANDAR",
      name: "Estándar",
      badge: "Esencial",
      tagline: "Bot IA 24/7 en WhatsApp + SINKR∞ App para catálogo, pedidos y alertas.",
      idealFor: "Comercios y emprendimientos que desean dejar de perder ventas por demoras en WhatsApp.",
      priceUsdMonthly: 19,
      apiPrefix: "sk_live_std_",
      quotaRequests: "15,000 req / mes",
      rateLimit: "30 req / min",
      maxKeys: 1,
      accent: "blue",
      featured: false,
      features: [
        "Asistente virtual IA activo 24/7 en WhatsApp para atender a tus clientes",
        "Panel web SINKR∞ App para catálogo, precios, stock y alertas de pedidos en vivo",
        "Recepción de comprobantes de Pago Móvil con alertas instantáneas en pantalla",
        "Reporte PDF de Cierre Semanal de ventas y movimientos",
        "1 llave API dedicada + soporte directo"
      ]
    },
    {
      id: "pro",
      apiPlanEnum: "PRO",
      clientBotPlan: "PRO",
      name: "Pro",
      badge: "Más popular",
      tagline: "Todo el Plan Estándar + validación bancaria automática anti-fraude.",
      idealFor: "Negocios con alto flujo de Pago Móvil que necesitan cobros seguros y automáticos.",
      priceUsdMonthly: 49,
      apiPrefix: "sk_live_pro_",
      quotaRequests: "150,000 req / mes",
      rateLimit: "180 req / min",
      maxKeys: 5,
      accent: "indigo",
      featured: true,
      features: [
        "Todo lo incluido en el Plan Estándar (Bot IA 24/7 + SINKR∞ App + PDF Semanal)",
        "Validación automática de Pago Móvil en segundos contra el banco",
        "Elimina capturas falsas editadas y ahorra tiempo en caja",
        "Lectura inteligente de fotos de récipes y comprobantes + carga rápida de inventario",
        "Hasta 5 llaves API + historial de conversaciones con clientes"
      ]
    },
    {
      id: "gold",
      apiPlanEnum: "PRO",
      clientBotPlan: "GOLD",
      name: "Gold",
      badge: "Empresarial",
      tagline: "Bot IA + validación bancaria + enlace directo con tu sistema administrativo.",
      idealFor: "Empresas consolidadas y multi-sucursal que operan con Saint, Profit Plus, A2, Valery o Premium Soft.",
      priceUsdMonthly: 119,
      apiPrefix: "sk_live_gld_",
      quotaRequests: "1,000,000 req / mes",
      rateLimit: "1,000 req / min",
      maxKeys: "Ilimitadas",
      accent: "gold",
      featured: false,
      features: [
        "Todo lo del Plan Pro (Bot IA 24/7 + SINKR∞ App + validación bancaria anti-fraude)",
        "Conexión directa con Saint, Profit Plus, A2, Valery y Premium Soft",
        "Sincronización automática de inventario multi-sucursal, precios y facturación",
        "Cierre semanal en PDF enviado automáticamente al WhatsApp del dueño",
        "Llaves API ilimitadas + acompañamiento técnico personalizado"
      ]
    }
  ],

  // Equipo Fundador (cada tarjeta abre un pop-up con resumen de rol y contacto WhatsApp)
  founders: [
    {
      id: "fidel",
      name: "Fidel Pereira",
      role: "Fundador",
      shortRole: "Visión Estratégica & Origen de SINKR∞",
      image: "assets/founder-fidel.jpg",
      whatsappRaw: "584121701431",
      whatsappDisplay: "+58 412 1701431",
      summary:
        "Fundador de SINKR∞ y mente estratégica detrás de llevar inteligencia artificial, cobros verificados y automatización real a los comercios de Venezuela y Latinoamérica.",
      bio:
        "Fidel impulsa la visión fundacional del ecosistema SINKR∞ y SINKR∞ App, transformando procesos manuales de venta y validación de pagos en experiencias rápidas, confiables y escalables para todo tipo de comercios.",
      highlights: [
        "Visión de Producto",
        "Alianzas Estratégicas",
        "Expansión Comercial"
      ],
      whatsappText:
        "Hola Fidel Pereira, vi tu perfil en SINKR∞ y quiero conversar sobre alianzas y planes."
    },
    {
      id: "jesus",
      name: "Jesús Romero",
      role: "CEO",
      shortRole: "Dirección Ejecutiva & Crecimiento",
      image: "assets/founder-jesus.jpg",
      whatsappRaw: "584125467532",
      whatsappDisplay: "+58 412 5467532",
      summary:
        "Chief Executive Officer encargado de la dirección ejecutiva, estrategia comercial, acompañamiento al cliente y crecimiento operativo de SINKR∞.",
      bio:
        "Jesús lidera la operación comercial y la experiencia integral de cada cliente —desde comercios en Plan Estándar hasta cadenas multi-sucursal en Plan Gold— garantizando resultados tangibles desde la primera semana.",
      highlights: [
        "Dirección Ejecutiva",
        "Estrategia Comercial",
        "Éxito del Cliente"
      ],
      whatsappText:
        "Hola Jesús Romero, vi tu perfil en SINKR∞ y deseo información comercial sobre los planes."
    },
    {
      id: "jose",
      name: "José Davalillo",
      role: "Ingeniero y Desarrollador de Software",
      shortRole: "Arquitectura Backend, IA, Seguridad & APIs",
      image: "assets/founder-jose.jpg",
      summary:
        "Ingeniero y Desarrollador principal de software responsable de Max, la arquitectura Node.js/TypeScript, la API REST multi-tenant y la pasarela integrada de SINKR∞.",
      bio:
        "José diseña y desarrolla el núcleo tecnológico de SINKR∞: el motor conversacional de Max con IA, la API Bancaria anti-fraude, el Bot Comercial entregable con cierres PDF, webhooks para ERP (Saint, Profit Plus, A2, Valery, Premium Soft) y la provisión automática de API Keys.",
      highlights: [
        "Node.js · TypeScript · PostgreSQL",
        "Motor IA Max & WhatsApp",
        "API Bancaria & Integración ERP"
      ],
      whatsappText:
        "Hola José Davalillo, vi tu perfil en SINKR∞ y quiero consultarte sobre la integración de API, ERP y el bot Max."
    }
  ],

  // Conexión a los 2 servicios backend de Chatbot-ApiRest.zip
  apiStudio: {
    mode: "local_plus_webhook",

    // 1) API SaaS embebida en este mismo servidor (deja vacío para usar el mismo dominio de Railway)
    baseUrl: "",
    chatEndpoint: "/api/v1/chatbot/message",
    provisionEndpoint: "/api/v1/chatbot/api-keys/generate",
    conversationsEndpoint: "/api/v1/chatbot/conversations",
    historyEndpoint: "/api/v1/chatbot/history",
    rateEndpoint: "/api/v1/chatbot/rate",
    stockSyncEndpoint: "/api/v1/stock/import",
    authHeaderName: "X-API-Key",
    authPrefix: "",
    masterApiToken: "",
    customKeyPrefix: "sk_live_",
    autoGenerateKeyOnPayment: true,

    // 2) client-sales-bot.ts (puerto 3001)
    clientBotBaseUrl: "http://localhost:3001",
    clientBotPanelToken: "",
    clientBotChatEndpoint: "/api/chat",
    clientBotStateEndpoint: "/api/state",
    clientBotToggleEndpoint: "/api/toggle",
    clientBotPdfEndpoint: "/api/reports/weekly-pdf",

    // Especificación OpenAPI con las rutas reales de Chatbot-ApiRest.zip
    uploadedSpecName: "sinkroo-chatbot-apirest-v2.json",
    uploadedSpec: {
      openapi: "3.1.0",
      info: {
        title: "SINKR∞ Chatbot-ApiRest v2.0 (Max + Client Sales Bot)",
        version: "2.0.0",
        description:
          "API REST multi-tenant de SINKR∞. Conecta Max (+584166214410) y el Bot Comercial Entregable."
      },
      paths: {
        "/api/v1/chatbot/api-keys/generate": {
          post: {
            summary: "Crear Tenant y emitir API Key (sk_live_...) tras confirmar Pago Móvil"
          }
        },
        "/api/v1/chatbot/message": {
          post: {
            summary: "Enviar mensaje o imagen Base64 a Max / Bot de Ventas (X-API-Key)"
          }
        },
        "/api/v1/chatbot/conversations": {
          get: {
            summary: "Listar sesiones activas de WhatsApp/API del Tenant"
          }
        },
        "/api/v1/chatbot/history/{conversationId}": {
          get: {
            summary: "Historial completo de mensajes y estados de una conversación"
          }
        },
        "/api/v1/chatbot/rate/{queryId}": {
          post: {
            summary: "Calificar respuesta del bot (helpful: true/false)"
          }
        },
        "/api/v1/stock/import": {
          post: {
            summary: "Sincronizar inventario/catálogo (compatible Premium Soft / ERP)"
          }
        },
        "[:3001] /api/chat": {
          post: {
            summary: "Chat directo con el Bot Comercial Entregable (client-sales-bot.ts)"
          }
        },
        "[:3001] /api/state": {
          get: {
            summary: "Estado en vivo, QR WhatsApp, alertas de pago y métricas semanales"
          }
        },
        "[:3001] /api/reports/weekly-pdf": {
          get: {
            summary: "Descargar Reporte PDF de Cierre Semanal de Ventas y Movimientos"
          }
        }
      }
    }
  }
};
