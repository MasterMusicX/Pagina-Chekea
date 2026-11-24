/**
 * ============================================================================
 * CHEKEA — CONFIGURACIÓN CENTRAL (FÁCIL DE EDITAR A MANO)
 * ============================================================================
 * Conectado a tus dos servicios backend:
 *  1) standalone-chatbot-api.ts  -> API SaaS del Chatbot + Generador de API Keys
 *  2) client-sales-bot.ts        -> Bot Comercial WhatsApp + Panel QR + PDF Semanal
 *
 * Para reemplazar las imágenes de ejemplo:
 * Sustituye los archivos dentro de /assets/ manteniendo el mismo nombre.
 */

window.CHEKEA_CONFIG = {
  brand: {
    name: "Chekea",
    tagline: "Inteligencia que responde. APIs que escalan.",
    email: "contacto@chekea.io",
    country: "Venezuela",
    year: 2026
  },

  // Datos oficiales de Pago Móvil (Venezuela - Banco Mercantil) y WhatsApp
  payment: {
    country: "Venezuela",
    bankName: "Banco Mercantil",
    bankCode: "0105",
    cedulaRaw: "31091406",
    cedulaFormatted: "V-31.091.406",
    phoneRaw: "04246003606",
    phoneFormatted: "0424-6003606",
    whatsappInternational: "584246003606",
    holderName: "José Davalillo",
    exchangeRateBs: 52.50,
    annualDiscountPercent: 20
  },

  // Rutas de imágenes principales (reemplaza los archivos en /assets/ cuando gustes)
  media: {
    heroShowcase: "assets/hero-showcase.jpg",
    aiArchitecture: "assets/ai-architecture.jpg"
  },

  // Planes disponibles: Estándar, Pro y Gold
  // `apiPlanEnum` se envía tal cual al campo `plan` de POST /api/v1/chatbot/api-keys/generate
  plans: [
    {
      id: "estandar",
      apiPlanEnum: "ESTANDAR",
      name: "Estándar",
      badge: "Esencial",
      tagline: "Bot IA 24/7, catálogo real, alertas Pago Móvil y cierre semanal PDF.",
      priceUsdMonthly: 19,
      apiPrefix: "sk_live_std_",
      quotaRequests: "15,000 req / mes",
      rateLimit: "30 req / min",
      maxKeys: 1,
      accent: "blue",
      featured: false,
      features: [
        "Acceso inmediato al Bot Comercial + API Chatbot",
        "Catálogo real BD, toma de pedidos y alertas Pago Móvil",
        "Reporte PDF de Cierre Semanal automático",
        "1 API Key dedicada (X-API-Key / Bearer)",
        "Soporte directo por WhatsApp"
      ]
    },
    {
      id: "pro",
      apiPlanEnum: "PRO",
      name: "Pro",
      badge: "Más popular",
      tagline: "Todo Estándar + validación automática de Pago Móvil vía API Bancaria.",
      priceUsdMonthly: 49,
      apiPrefix: "sk_live_pro_",
      quotaRequests: "150,000 req / mes",
      rateLimit: "180 req / min",
      maxKeys: 5,
      accent: "indigo",
      featured: true,
      features: [
        "Acceso completo al Bot WhatsApp QR + API SaaS",
        "Validación automática Pago Móvil anti-fraude",
        "150,000 req/mes + lectura de récipes/fotos en Base64",
        "Sincronización de stock (/api/v1/stock/import)",
        "Historial de conversaciones y calificación de respuestas",
        "Soporte prioritario por WhatsApp"
      ]
    },
    {
      id: "gold",
      apiPlanEnum: "GOLD",
      name: "Gold",
      badge: "Empresarial",
      tagline: "Todo Pro + stock multi-sucursal y Webhook directo a ERP (Saint/Profit/A2).",
      priceUsdMonthly: 119,
      apiPrefix: "sk_live_gld_",
      quotaRequests: "1,000,000 req / mes",
      rateLimit: "1,000 req / min",
      maxKeys: "Ilimitadas",
      accent: "gold",
      featured: false,
      features: [
        "Acceso VIP Bot Marca Blanca + API Empresarial",
        "Stock multi-sucursal + Webhook firmado a ERP (Saint/Profit)",
        "1,000,000 req/mes con API Keys ilimitadas",
        "Cierre semanal PDF programado directo al WhatsApp del dueño",
        "Consultoría técnica directa con ingeniería",
        "Atención VIP 24/7 por WhatsApp"
      ]
    }
  ],

  // Equipo Fundador (cada tarjeta abre un pop-up con su resumen y contacto WhatsApp)
  founders: [
    {
      id: "fidel",
      name: "Fidel Pereira",
      role: "Fundador",
      shortRole: "Visión Estratégica & Origen",
      image: "assets/founder-fidel.jpg",
      summary:
        "Fundador de Chekea y mente estratégica detrás del propósito de democratizar la inteligencia artificial y los pagos digitales en Latinoamérica.",
      bio:
        "Fidel impulsa la visión fundacional del ecosistema Chekea, identificando oportunidades reales del mercado venezolano y regional para transformar procesos manuales en soluciones digitales veloces, confiables y accesibles.",
      highlights: [
        "Visión de Producto",
        "Alianzas Estratégicas",
        "Expansión Regional"
      ],
      whatsappText:
        "Hola equipo Chekea, vi el perfil de Fidel Pereira (Fundador) y me gustaría conversar sobre alianzas y planes."
    },
    {
      id: "jesus",
      name: "Jesús Romero",
      role: "CEO",
      shortRole: "Dirección Ejecutiva & Crecimiento",
      image: "assets/founder-jesus.jpg",
      summary:
        "Chief Executive Officer encargado de la dirección ejecutiva, estrategia comercial, experiencia del cliente y escalamiento operativo de Chekea.",
      bio:
        "Jesús lidera el crecimiento comercial y la operación integral de la compañía, asegurando que cada cliente —desde emprendedores en el plan Estándar hasta empresas Gold— reciba un servicio impecable, transparente y orientado a resultados.",
      highlights: [
        "Dirección Ejecutiva",
        "Estrategia Comercial",
        "Éxito del Cliente"
      ],
      whatsappText:
        "Hola equipo Chekea, vi el perfil de Jesús Romero (CEO) y quiero información comercial sobre sus soluciones."
    },
    {
      id: "jose",
      name: "José Davalillo",
      role: "Ingeniero y Desarrollador de Software",
      shortRole: "Arquitectura de Software, IA & APIs",
      image: "assets/founder-jose.jpg",
      summary:
        "Ingeniero y Desarrollador principal de software responsable de la arquitectura técnica, el motor de IA conversacional, la pasarela de pago y el sistema de emisión automática de APIs.",
      bio:
        "José diseña y construye la infraestructura completa de Chekea bajo estándares modernos de ingeniería: interfaces ultrarrápidas, integración de pasarelas de pago venezolanas, seguridad criptográfica en la generación de API Keys y despliegues escalables listos para producción.",
      highlights: [
        "Arquitectura Full-Stack",
        "Motor API & Webhooks",
        "Integración IA & Pagos"
      ],
      whatsappText:
        "Hola José Davalillo, vi tu perfil en Chekea y quiero consultarte sobre la integración de API y los planes disponibles."
    }
  ],

  // ==========================================================================
  // CONEXIÓN REAL A TUS 2 ARCHIVOS BACKEND (standalone-chatbot-api.ts y client-sales-bot.ts)
  // ==========================================================================
  apiStudio: {
    // "local_plus_webhook": intenta llamar a tu backend real; si está apagado emite respaldo local para pruebas
    // "remote_only": exige respuesta 201 real de POST /api/v1/chatbot/api-keys/generate
    mode: "local_plus_webhook",

    // 1) Backend standalone-chatbot-api.ts (npm run dev:api -> puerto 3000)
    baseUrl: "http://localhost:3000",
    chatEndpoint: "/api/v1/chatbot/message",
    provisionEndpoint: "/api/v1/chatbot/api-keys/generate",
    conversationsEndpoint: "/api/v1/chatbot/conversations",
    historyEndpoint: "/api/v1/chatbot/history",
    rateEndpoint: "/api/v1/chatbot/rate",
    stockSyncEndpoint: "/api/v1/stock/import",
    authHeaderName: "X-API-Key",
    authPrefix: "",
    // Coloca aquí tu API Key maestra/admin de standalone-chatbot-api.ts para crear nuevos tenants al pagar
    masterApiToken: "",
    customKeyPrefix: "sk_live_",
    autoGenerateKeyOnPayment: true,

    // 2) Backend client-sales-bot.ts (npm run dev:client-bot -> puerto 3001)
    clientBotBaseUrl: "http://localhost:3001",
    clientBotPanelToken: "", // Si defines CLIENT_PANEL_TOKEN en tu .env, colócalo aquí o en API Studio
    clientBotChatEndpoint: "/api/chat",
    clientBotStateEndpoint: "/api/state",
    clientBotToggleEndpoint: "/api/toggle",
    clientBotPdfEndpoint: "/api/reports/weekly-pdf",

    // Especificación OpenAPI cargada por defecto con los endpoints reales de tus 2 archivos
    uploadedSpecName: "chekea-backend-v1.json",
    uploadedSpec: {
      openapi: "3.1.0",
      info: {
        title: "Chekea Standalone Chatbot API + Client Sales Bot",
        version: "1.0.0",
        description:
          "Endpoints conectados directamente a standalone-chatbot-api.ts (:3000) y client-sales-bot.ts (:3001)."
      },
      paths: {
        "/api/v1/chatbot/api-keys/generate": {
          post: {
            summary: "Crear Tenant y generar API Key (sk_live_...) tras confirmar pago"
          }
        },
        "/api/v1/chatbot/message": {
          post: {
            summary: "Enviar mensaje o imagen Base64 al Chatbot SaaS (X-API-Key)"
          }
        },
        "/api/v1/chatbot/conversations": {
          get: {
            summary: "Listar conversaciones activas del tenant"
          }
        },
        "/api/v1/chatbot/history/{conversationId}": {
          get: {
            summary: "Consultar historial completo de una conversación"
          }
        },
        "/api/v1/chatbot/rate/{queryId}": {
          post: {
            summary: "Calificar respuesta del Chatbot (helpful: true/false)"
          }
        },
        "/api/v1/stock/import": {
          post: {
            summary: "Sincronizar catálogo / inventario de productos del cliente"
          }
        },
        "[:3001] /api/chat": {
          post: {
            summary: "Enviar mensaje al Bot Comercial (client-sales-bot.ts)"
          }
        },
        "[:3001] /api/state": {
          get: {
            summary: "Estado del Bot, QR WhatsApp, alertas de pago y resumen semanal"
          }
        },
        "[:3001] /api/reports/weekly-pdf": {
          get: {
            summary: "Descargar PDF de Cierre Semanal de Ventas y Movimientos"
          }
        }
      }
    }
  }
};
