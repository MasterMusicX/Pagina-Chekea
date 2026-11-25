/**
 * ============================================================================
 * CKEKEA — SERVIDOR STANDALONE 100% INDEPENDIENTE (RAILWAY + NEON + WHATSAPP)
 * ============================================================================
 * Corre todo en un único servicio independiente sin depender de enlaces externos:
 *  - Web multipágina (index, login, dashboard, admin, chatbot, planes, api-studio, fundadores)
 *  - Auth seguro (Neon PostgreSQL + scrypt + JWT) + Superadmin (josemigueldav05@gmail.com)
 *  - Gestor de inventario por empresa (`products` + `stocks`)
 *  - Bot WhatsApp integrado (`server/whatsappBot.js` con QR, Pairing Code y Toggle ON/OFF)
 *  - API pública SaaS (`/api/v1/chatbot/*`, `/api/v1/stock/import`, `/api/v1/bot/*`)
 *  - Adaptador de API Bancaria (`server/bankApi.js`) + analíticas por empresa (`usage_metrics`)
 */

"use strict";

const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const { Pool } = require("pg");
const { BANK_PROVIDERS, maskSecret, verifyBankPayment } = require("./bankApi");
const whatsappBot = require("./whatsappBot");

const PORT = Number(process.env.PORT || 3000);
const DB_URL = (
  process.env.DATABASE_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL ||
  ""
).trim();
const JWT_SECRET = (process.env.JWT_SECRET || "premium_soft_jwt_secret_key_2026_secure").trim();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || "").trim();
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
const OPENROUTER_API_URL = process.env.OPENROUTER_API_URL || "https://openrouter.ai/api/v1/chat/completions";

const INITIAL_SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || "josemigueldav05@gmail.com").trim().toLowerCase();
const INITIAL_SUPERADMIN_PASS = process.env.SUPERADMIN_PASSWORD || "Zangetsu1531.";

const pool = DB_URL
  ? new Pool({
      connectionString: DB_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

let dbReady = false;
let dbLastError = DB_URL ? null : "Falta configurar la variable DATABASE_URL en Railway → Variables.";

// ============================================================================
// UTILIDADES CRIPTOGRÁFICAS
// ============================================================================
function uuidv4() {
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toBase64Url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function generateTenantApiKey(tenantId, tenantSecret) {
  const encodedId = toBase64Url(tenantId);
  const masterSecret = `${JWT_SECRET}:${tenantSecret}`;
  const signature = crypto
    .createHmac("sha256", masterSecret)
    .update(tenantId)
    .digest("hex")
    .substring(0, 32);
  return `sk_live_${encodedId}_${signature}`;
}

async function verifyTenantApiKey(apiKey) {
  if (!pool || !apiKey || !apiKey.startsWith("sk_live_")) return null;
  const parts = apiKey.split("_");
  if (parts.length < 4) return null;
  const signature = parts.pop();
  const encodedId = parts.slice(2).join("_");

  let tenantId;
  try {
    tenantId = fromBase64Url(encodedId);
  } catch {
    return null;
  }

  const res = await pool.query(
    `SELECT t.id AS tenant_id, t.webhook_secret, wc.*
     FROM tenants t
     LEFT JOIN web_clients wc ON wc.tenant_id = t.id
     WHERE t.id = $1 LIMIT 1`,
    [tenantId]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  const expectedKey = generateTenantApiKey(row.tenant_id, row.webhook_secret);
  const expectedSig = expectedKey.split("_").pop();

  try {
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return row;
}

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    const parts = String(storedHash || "").split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return resolve(false);
    const salt = parts[1];
    const expectedHex = parts[2];
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      const a = Buffer.from(expectedHex, "hex");
      const b = Buffer.from(derivedKey.toString("hex"), "hex");
      if (a.length !== b.length) return resolve(false);
      resolve(crypto.timingSafeEqual(a, b));
    });
  });
}

function signClientJwt(client) {
  return jwt.sign(
    {
      sub: client.tenant_id,
      clientId: client.id,
      email: client.email,
      role: client.role || "USER",
      planTier: client.plan_tier
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sanitizeClient(row) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    fullName: row.full_name,
    businessName: row.business_name,
    businessType: row.business_type,
    email: row.email,
    phone: row.phone,
    role: row.role || "USER",
    isActive: row.is_active !== false,
    planTier: row.plan_tier,
    paymentStatus: row.payment_status,
    paymentReference: row.payment_reference,
    botEnabled: row.bot_enabled,
    botName: row.bot_name,
    whatsappPhone: row.whatsapp_phone,
    businessHours: row.business_hours,
    deliveryInfo: row.delivery_info,
    apiKey: row.api_key,
    createdAt: row.created_at
  };
}

function sanitizeBankConfig(row) {
  if (!row) {
    return {
      provider: "MERCANTIL",
      verificationMode: "MANUAL",
      apiBaseUrl: "",
      apiKeyMasked: "",
      hasApiKey: false,
      hasClientSecret: false,
      merchantId: "",
      accountPhone: process.env.PAYMENT_PHONE || "0424-6003606",
      accountRif: process.env.PAYMENT_RIF || "V-31.091.406",
      autoApprove: true
    };
  }
  return {
    id: row.id,
    scope: row.scope,
    provider: row.provider,
    verificationMode: row.verification_mode,
    apiBaseUrl: row.api_base_url || "",
    apiKeyMasked: maskSecret(row.api_key),
    hasApiKey: Boolean(row.api_key),
    hasClientSecret: Boolean(row.client_secret),
    merchantId: row.merchant_id || "",
    accountPhone: row.account_phone || "",
    accountRif: row.account_rif || "",
    autoApprove: row.auto_approve !== false,
    updatedAt: row.updated_at
  };
}

// ============================================================================
// BASE DE DATOS: ESQUEMA, SEED SUPERADMIN Y CONSUMO
// ============================================================================
async function ensureMainBranch(clientDb, tenantId) {
  const existing = await clientDb.query(
    `SELECT id FROM branches WHERE tenant_id = $1 AND is_main = true LIMIT 1`,
    [tenantId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id;

  const branchId = uuidv4();
  await clientDb.query(
    `INSERT INTO branches (id, name, code_premium_soft, is_main, tenant_id, created_at, updated_at)
     VALUES ($1, 'Almacén Principal', '01', true, $2, NOW(), NOW())`,
    [branchId, tenantId]
  );
  return branchId;
}

async function createAccountInDb(db, opts) {
  const normalizedEmail = String(opts.email).trim().toLowerCase();
  const safePlanTier = ["ESTANDAR", "PRO", "GOLD"].includes(String(opts.planTier || "PRO").toUpperCase())
    ? String(opts.planTier || "PRO").toUpperCase()
    : "PRO";
  const prismaPlan = safePlanTier === "ESTANDAR" ? "LITE" : "PRO";
  const safeRubro = ["RETAIL", "PHARMACY", "TECH", "HARDWARE"].includes(String(opts.businessType || "RETAIL").toUpperCase())
    ? String(opts.businessType || "RETAIL").toUpperCase()
    : "RETAIL";
  const safeRole = String(opts.role || "USER").toUpperCase() === "SUPERADMIN" ? "SUPERADMIN" : "USER";
  const cleanPhone = String(opts.phone || "").replace(/\D/g, "") || null;

  const passwordHash = await hashPassword(String(opts.password));
  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const signatureTag = `[${safeRubro}] — ${String(opts.businessName).trim()} Bot`;

  const existingTenant = await db.query(
    `SELECT id, webhook_secret FROM tenants WHERE email = $1 LIMIT 1`,
    [normalizedEmail]
  );

  let tenantId;
  let activeSecret;
  if (existingTenant.rows.length > 0) {
    tenantId = existingTenant.rows[0].id;
    activeSecret = existingTenant.rows[0].webhook_secret || webhookSecret;
    await db.query(
      `UPDATE tenants
       SET name = $1, plan = $2::"PlanType", bot_signature = $3,
           whatsapp_enabled = true, whatsapp_phone = COALESCE($4, whatsapp_phone), updated_at = NOW()
       WHERE id = $5`,
      [String(opts.businessName).trim(), prismaPlan, signatureTag, cleanPhone, tenantId]
    );
  } else {
    tenantId = uuidv4();
    activeSecret = webhookSecret;
    await db.query(
      `INSERT INTO tenants (id, name, email, plan, webhook_secret, whatsapp_enabled, whatsapp_phone, bot_signature, created_at, updated_at)
       VALUES ($1, $2, $3, $4::"PlanType", $5, true, $6, $7, NOW(), NOW())`,
      [tenantId, String(opts.businessName).trim(), normalizedEmail, prismaPlan, activeSecret, cleanPhone, signatureTag]
    );
  }

  await ensureMainBranch(db, tenantId);
  const apiKey = generateTenantApiKey(tenantId, activeSecret);
  const clientId = uuidv4();

  const inserted = await db.query(
    `INSERT INTO web_clients
      (id, tenant_id, full_name, business_name, business_type, email, phone, password_hash,
       role, is_active, plan_tier, payment_status, bot_enabled, bot_name, whatsapp_phone, api_key, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, true, 'Max', $12, $13, NOW(), NOW())
     RETURNING *`,
    [
      clientId,
      tenantId,
      String(opts.fullName).trim(),
      String(opts.businessName).trim(),
      safeRubro,
      normalizedEmail,
      cleanPhone,
      passwordHash,
      safeRole,
      safePlanTier,
      opts.paymentStatus || (safeRole === "SUPERADMIN" ? "PAID" : "TRIAL"),
      cleanPhone,
      apiKey
    ]
  );

  return inserted.rows[0];
}

async function ensureSchemaAndSeed() {
  if (!pool) {
    dbReady = false;
    dbLastError = "DATABASE_URL no está configurada en las Variables de Railway.";
    console.warn("[DB]", dbLastError);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_clients (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      full_name         TEXT NOT NULL,
      business_name     TEXT NOT NULL,
      business_type     TEXT NOT NULL DEFAULT 'RETAIL',
      email             TEXT NOT NULL UNIQUE,
      phone             TEXT,
      password_hash     TEXT NOT NULL,
      role              TEXT NOT NULL DEFAULT 'USER',
      is_active         BOOLEAN NOT NULL DEFAULT TRUE,
      plan_tier         TEXT NOT NULL DEFAULT 'ESTANDAR',
      payment_status    TEXT NOT NULL DEFAULT 'TRIAL',
      payment_reference TEXT,
      bot_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
      bot_name          TEXT NOT NULL DEFAULT 'Max',
      whatsapp_phone    TEXT,
      business_hours    TEXT DEFAULT 'Lunes a Sábado de 8:00am a 7:00pm',
      delivery_info     TEXT DEFAULT 'Sí, hacemos envíos y entregas en tienda.',
      api_key           TEXT NOT NULL,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE web_clients ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER';
    ALTER TABLE web_clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS usage_metrics (
      id           TEXT PRIMARY KEY,
      tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      metric_type  TEXT NOT NULL,
      endpoint     TEXT,
      tokens_used  INTEGER NOT NULL DEFAULT 0,
      latency_ms   INTEGER NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_usage_metrics_tenant_date ON usage_metrics(tenant_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS bank_integrations (
      id                TEXT PRIMARY KEY,
      tenant_id         TEXT UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
      scope             TEXT NOT NULL DEFAULT 'TENANT',
      provider          TEXT NOT NULL DEFAULT 'MERCANTIL',
      verification_mode TEXT NOT NULL DEFAULT 'MANUAL',
      api_base_url      TEXT,
      api_key           TEXT,
      client_secret     TEXT,
      merchant_id       TEXT,
      account_phone     TEXT,
      account_rif       TEXT,
      auto_approve      BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const existingAdmin = await pool.query(
    `SELECT id, role FROM web_clients WHERE email = $1 LIMIT 1`,
    [INITIAL_SUPERADMIN_EMAIL]
  );

  if (!existingAdmin.rows.length) {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await createAccountInDb(db, {
        fullName: "José Davalillo",
        businessName: "Ckekea HQ",
        businessType: "TECH",
        email: INITIAL_SUPERADMIN_EMAIL,
        phone: "584246003606",
        password: INITIAL_SUPERADMIN_PASS,
        role: "SUPERADMIN",
        planTier: "GOLD",
        paymentStatus: "PAID"
      });
      await db.query("COMMIT");
      console.log(`[Seed] Superadmin listo en Neon: ${INITIAL_SUPERADMIN_EMAIL}`);
    } catch (err) {
      await db.query("ROLLBACK").catch(() => {});
      console.warn("[Seed]", err.message);
    } finally {
      db.release();
    }
  } else if (existingAdmin.rows[0].role !== "SUPERADMIN") {
    await pool.query(`UPDATE web_clients SET role = 'SUPERADMIN', is_active = true WHERE id = $1`, [
      existingAdmin.rows[0].id
    ]);
  }

  dbReady = true;
  dbLastError = null;
  console.log("[DB] Neon PostgreSQL conectado correctamente.");
}

function recordUsage(tenantId, metricType, endpoint, tokensUsed, latencyMs) {
  if (!pool || !tenantId) return;
  pool
    .query(
      `INSERT INTO usage_metrics (id, tenant_id, metric_type, endpoint, tokens_used, latency_ms, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), tenantId, metricType, endpoint || "", Number(tokensUsed || 0), Number(latencyMs || 0)]
    )
    .catch(() => {});
}

// ============================================================================
// MOTOR CONVERSACIONAL UNIFICADO (WEB + WHATSAPP + /api/v1/chatbot/message)
// ============================================================================
async function safeJsonFetch(url, options) {
  try {
    const res = await fetch(url, Object.assign({ timeout: 9000 }, options));
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function generateInventoryBotReply(clientRow, message, endpointLabel) {
  const started = Date.now();
  const tenantId = clientRow.tenant_id;

  if (clientRow.bot_enabled === false) {
    return {
      reply: "Tu bot está APAGADO actualmente. Actívalo desde el Dashboard para responder a los clientes.",
      source: "Bot Pausado"
    };
  }

  const invRes = await pool.query(
    `SELECT p.sku, p.name, p.active_ingredient, p.presentation, p.base_price,
            COALESCE(SUM(s.quantity), 0)::int AS quantity
     FROM products p
     LEFT JOIN stocks s ON s.product_id = p.id
     WHERE p.tenant_id = $1 AND p.is_active = true
     GROUP BY p.id
     ORDER BY quantity DESC, p.name ASC
     LIMIT 60`,
    [tenantId]
  );

  const catalogLines = invRes.rows.map(
    (r, idx) =>
      `${idx + 1}. ${r.name} (SKU: ${r.sku} | ${r.presentation} | Cat: ${r.active_ingredient}) — $${Number(r.base_price).toFixed(2)} — Stock: ${r.quantity}`
  );

  if (OPENROUTER_API_KEY) {
    const systemPrompt = [
      `Eres ${clientRow.bot_name || "Max"}, asesor humano de ventas de "${clientRow.business_name || "Ckekea"}" (${clientRow.business_type || "RETAIL"}) atendiendo por WhatsApp.`,
      `Horario: ${clientRow.business_hours || "Lunes a Sábado 8am - 7pm"}. Envíos: ${clientRow.delivery_info || "Sí, hacemos envíos y entregas en tienda."}.`,
      `REGLAS: Responde corto, humano y directo (máximo 4 líneas). Usa ÚNICAMENTE los productos y precios reales del inventario abajo. No inventes precios ni productos.`,
      ``,
      `INVENTARIO REAL (${invRes.rows.length} productos):`,
      catalogLines.length ? catalogLines.join("\n") : "(Inventario vacío todavía)"
    ].join("\n");

    const aiRes = await safeJsonFetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": `Ckekea-${clientRow.business_name || "Bot"}`
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const content =
      aiRes.ok &&
      aiRes.data &&
      aiRes.data.choices &&
      aiRes.data.choices[0] &&
      aiRes.data.choices[0].message &&
      aiRes.data.choices[0].message.content;

    const tokensUsed = (aiRes.data && aiRes.data.usage && aiRes.data.usage.total_tokens) || 0;
    if (content) {
      recordUsage(tenantId, "CHATBOT_MSG", endpointLabel || "/api/bot/chat", tokensUsed, Date.now() - started);
      return {
        reply: content.trim(),
        source: `OpenRouter AI + Neon (${invRes.rows.length} productos)`
      };
    }
  }

  recordUsage(tenantId, "CHATBOT_MSG", endpointLabel || "/api/bot/chat", 0, Date.now() - started);
  if (!invRes.rows.length) {
    return {
      reply: `Hola. Soy ${clientRow.bot_name || "Max"} de ${clientRow.business_name || "Ckekea"}. Aún no hay productos cargados en el inventario; sube tu CSV o agrega artículos desde el Dashboard para que los asimile al instante.`,
      source: "Neon Catalog Engine"
    };
  }

  const q = String(message || "").toLowerCase();
  const matches = invRes.rows.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.sku.toLowerCase().includes(q) ||
      String(r.active_ingredient || "").toLowerCase().includes(q)
  );
  const listToShow = matches.length ? matches.slice(0, 6) : invRes.rows.slice(0, 6);
  const lines = listToShow.map(
    (r, i) =>
      `${i + 1}. *${r.name}* — *$${Number(r.base_price).toFixed(2)}* (${r.quantity > 0 ? `${r.quantity} disponibles` : "Agotado"})`
  );

  return {
    reply: `${matches.length ? `Encontrado en ${clientRow.business_name}:` : `Catálogo disponible en ${clientRow.business_name}:`}\n${lines.join("\n")}\n\nIndícame el producto y cantidad que deseas.`,
    source: `Neon Catalog Engine (${invRes.rows.length} productos)`
  };
}

// Conectar mensajes entrantes del WhatsApp Bot embebido a Neon + IA
whatsappBot.setMessageHandler(async ({ phone, customerName, text }) => {
  if (!pool || !dbReady || !text) return null;
  // Usa la cuenta activa con inventario o el Superadmin principal
  const res = await pool.query(
    `SELECT * FROM web_clients
     WHERE is_active = true
     ORDER BY (CASE WHEN email = $1 THEN 0 ELSE 1 END), updated_at DESC
     LIMIT 1`,
    [INITIAL_SUPERADMIN_EMAIL]
  );
  if (!res.rows.length) return null;
  const clientRow = res.rows[0];
  if (!clientRow.bot_enabled) return null;
  const result = await generateInventoryBotReply(clientRow, `${customerName} (${phone}): ${text}`, "whatsapp_incoming");
  return result.reply;
});

// ============================================================================
// EXPRESS APP + MIDDLEWARES
// ============================================================================
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "6mb" }));

function requireDb(req, res, next) {
  if (!pool || !dbReady) {
    return res.status(503).json({
      success: false,
      error: dbLastError || "Base de datos Neon aún conectando. Verifica DATABASE_URL en las Variables de Railway."
    });
  }
  next();
}

const authHits = new Map();
function authRateLimit(req, res, next) {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = authHits.get(ip) || { count: 0, resetAt: now + 60000 };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 60000;
  }
  entry.count += 1;
  authHits.set(ip, entry);
  if (entry.count > 40) {
    return res.status(429).json({ success: false, error: "Demasiados intentos. Espera un minuto." });
  }
  next();
}

// Autenticación dual: Bearer JWT o X-API-Key (sk_live_...)
async function requireAuth(req, res, next) {
  if (!pool || !dbReady) return requireDb(req, res, next);
  try {
    const apiKeyHeader = req.headers["x-api-key"];
    const authHeader = req.headers.authorization || "";
    const rawApiKey =
      typeof apiKeyHeader === "string"
        ? apiKeyHeader.trim()
        : authHeader.startsWith("Bearer sk_live_")
          ? authHeader.slice(7).trim()
          : null;

    if (rawApiKey) {
      const tenantRow = await verifyTenantApiKey(rawApiKey);
      if (!tenantRow) return res.status(401).json({ success: false, error: "API Key inválida." });
      req.client = tenantRow;
      return next();
    }

    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return res.status(401).json({ success: false, error: "Sesión requerida. Inicia sesión primero." });
    }
    const payload = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      `SELECT * FROM web_clients WHERE id = $1 OR tenant_id = $2 LIMIT 1`,
      [payload.clientId || "", payload.sub || ""]
    );
    if (!result.rows.length) {
      return res.status(401).json({ success: false, error: "Cuenta no encontrada." });
    }
    const row = result.rows[0];
    if (row.is_active === false) {
      return res.status(403).json({ success: false, error: "Tu cuenta fue suspendida por un administrador." });
    }
    req.client = row;
    req.rawJwt = token;
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Token inválido o expirado." });
  }
}

function requireSuperadmin(req, res, next) {
  if (!req.client || req.client.role !== "SUPERADMIN") {
    return res.status(403).json({ success: false, error: "Acceso denegado: requiere rol Superadmin." });
  }
  next();
}

// ============================================================================
// HEALTH CHECK (SIEMPRE RESPONDE 200 PARA EVITAR CRASH-LOOP EN RAILWAY)
// ============================================================================
app.get("/api/health", async (_req, res) => {
  let dbStatus = "not_configured";
  if (pool) {
    try {
      await pool.query("SELECT 1");
      if (!dbReady) await ensureSchemaAndSeed().catch(() => {});
      dbStatus = "neon_connected";
    } catch (err) {
      dbStatus = "error: " + err.message;
    }
  }
  const wa = whatsappBot.getState();
  res.json({
    status: "ok",
    mode: "STANDALONE_INDEPENDENT",
    service: "ckekea-standalone-platform",
    database: dbStatus,
    dbHint: dbLastError,
    whatsapp: { active: wa.active, status: wa.status, phone: wa.connectedPhone },
    bankProviders: Object.keys(BANK_PROVIDERS),
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (_req, res) => res.redirect("/api/health"));

// ============================================================================
// 1. AUTENTICACIÓN: REGISTRO, LOGIN, PERFIL Y CAMBIO DE CONTRASEÑA
// ============================================================================
app.post("/api/auth/register", requireDb, authRateLimit, async (req, res) => {
  const {
    fullName,
    businessName,
    businessType = "RETAIL",
    email,
    phone = "",
    password,
    confirmPassword,
    planTier = "ESTANDAR"
  } = req.body || {};

  if (!fullName || !businessName || !email || !password) {
    return res.status(400).json({ success: false, error: "Completa nombre, negocio, correo y contraseña." });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ success: false, error: "La contraseña debe tener al menos 6 caracteres." });
  }
  if (typeof confirmPassword !== "undefined" && String(password) !== String(confirmPassword)) {
    return res.status(400).json({ success: false, error: "Las contraseñas no coinciden." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const exists = await db.query(`SELECT id FROM web_clients WHERE email = $1 LIMIT 1`, [normalizedEmail]);
    if (exists.rows.length > 0) {
      await db.query("ROLLBACK");
      return res.status(409).json({ success: false, error: "Ya existe una cuenta registrada con ese correo." });
    }
    const clientRow = await createAccountInDb(db, {
      fullName,
      businessName,
      businessType,
      email: normalizedEmail,
      phone,
      password,
      planTier,
      role: "USER"
    });
    await db.query("COMMIT");
    recordUsage(clientRow.tenant_id, "API_CALL", "/api/auth/register", 0, 0);
    return res.status(201).json({
      success: true,
      token: signClientJwt(clientRow),
      client: sanitizeClient(clientRow)
    });
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success: false, error: "Error registrando usuario: " + err.message });
  } finally {
    db.release();
  }
});

app.post("/api/auth/login", requireDb, authRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Ingresa tu correo y contraseña." });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await pool.query(`SELECT * FROM web_clients WHERE email = $1 LIMIT 1`, [normalizedEmail]);
    if (!result.rows.length) {
      return res.status(401).json({ success: false, error: "Correo o contraseña incorrectos." });
    }
    const row = result.rows[0];
    if (row.is_active === false) {
      return res.status(403).json({ success: false, error: "Esta cuenta está suspendida." });
    }
    const valid = await verifyPassword(String(password), row.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "Correo o contraseña incorrectos." });
    }
    recordUsage(row.tenant_id, "API_CALL", "/api/auth/login", 0, 0);
    return res.json({
      success: true,
      token: signClientJwt(row),
      client: sanitizeClient(row)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const [countRes, usageRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total_products, COALESCE(SUM(s.quantity), 0)::int AS total_units
         FROM products p LEFT JOIN stocks s ON s.product_id = p.id
         WHERE p.tenant_id = $1 AND p.is_active = true`,
        [req.client.tenant_id]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE metric_type = 'API_CALL')::int AS api_calls,
           COUNT(*) FILTER (WHERE metric_type = 'CHATBOT_MSG')::int AS chatbot_msgs
         FROM usage_metrics WHERE tenant_id = $1`,
        [req.client.tenant_id]
      )
    ]);

    res.json({
      success: true,
      client: sanitizeClient(req.client),
      stats: {
        totalProducts: countRes.rows[0].total_products,
        totalUnits: countRes.rows[0].total_units,
        apiCalls: usageRes.rows[0].api_calls,
        chatbotMsgs: usageRes.rows[0].chatbot_msgs
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/auth/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ success: false, error: "Completa la contraseña actual, la nueva y su confirmación." });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, error: "La nueva contraseña debe tener al menos 6 caracteres." });
    }
    if (String(newPassword) !== String(confirmNewPassword)) {
      return res.status(400).json({ success: false, error: "La nueva contraseña y su confirmación no coinciden." });
    }
    const ok = await verifyPassword(String(currentPassword), req.client.password_hash);
    if (!ok) return res.status(401).json({ success: false, error: "La contraseña actual es incorrecta." });

    const newHash = await hashPassword(String(newPassword));
    await pool.query(`UPDATE web_clients SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      newHash,
      req.client.id
    ]);
    await pool
      .query(
        `INSERT INTO operation_logs (id, tenant_id, operation, description, metadata, created_at)
         VALUES ($1, $2, 'PASSWORD_CHANGED', 'Cambio de contraseña realizado', '{}'::jsonb, NOW())`,
        [uuidv4(), req.client.tenant_id]
      )
      .catch(() => {});

    res.json({ success: true, message: "Contraseña actualizada correctamente." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 2. API BANCARIA PLUG-AND-PLAY + PAGOS
// ============================================================================
async function resolveEffectiveBankConfig(tenantId) {
  const tenantCfg = await pool.query(`SELECT * FROM bank_integrations WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
  if (tenantCfg.rows.length) return tenantCfg.rows[0];
  const globalCfg = await pool.query(`SELECT * FROM bank_integrations WHERE scope = 'GLOBAL' LIMIT 1`);
  return globalCfg.rows[0] || null;
}

app.get("/api/bank/providers", (_req, res) => res.json({ success: true, providers: BANK_PROVIDERS }));

app.get("/api/bank/config", requireAuth, async (req, res) => {
  try {
    const cfg = await resolveEffectiveBankConfig(req.client.tenant_id);
    res.json({ success: true, config: sanitizeBankConfig(cfg), providers: BANK_PROVIDERS });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/bank/config", requireAuth, async (req, res) => {
  try {
    const {
      provider = "MERCANTIL",
      verificationMode = "MANUAL",
      apiBaseUrl = "",
      apiKey,
      clientSecret,
      merchantId = "",
      accountPhone = "",
      accountRif = "",
      autoApprove = true
    } = req.body || {};

    const safeProvider = BANK_PROVIDERS[String(provider).toUpperCase()] ? String(provider).toUpperCase() : "MERCANTIL";
    const safeMode = ["MANUAL", "BANK_API", "SIMULATED"].includes(String(verificationMode).toUpperCase())
      ? String(verificationMode).toUpperCase()
      : "MANUAL";

    const existing = await pool.query(`SELECT * FROM bank_integrations WHERE tenant_id = $1 LIMIT 1`, [req.client.tenant_id]);
    let saved;
    if (existing.rows.length) {
      saved = await pool.query(
        `UPDATE bank_integrations
         SET provider = $1, verification_mode = $2, api_base_url = $3,
             api_key = COALESCE(NULLIF($4, ''), api_key),
             client_secret = COALESCE(NULLIF($5, ''), client_secret),
             merchant_id = $6, account_phone = $7, account_rif = $8,
             auto_approve = $9, updated_at = NOW()
         WHERE id = $10 RETURNING *`,
        [
          safeProvider, safeMode, String(apiBaseUrl).trim(),
          apiKey ? String(apiKey).trim() : "",
          clientSecret ? String(clientSecret).trim() : "",
          String(merchantId).trim(), String(accountPhone).trim(), String(accountRif).trim(),
          Boolean(autoApprove), existing.rows[0].id
        ]
      );
    } else {
      saved = await pool.query(
        `INSERT INTO bank_integrations
          (id, tenant_id, scope, provider, verification_mode, api_base_url, api_key, client_secret,
           merchant_id, account_phone, account_rif, auto_approve, updated_at)
         VALUES ($1, $2, 'TENANT', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
        [
          uuidv4(), req.client.tenant_id, safeProvider, safeMode, String(apiBaseUrl).trim(),
          apiKey ? String(apiKey).trim() : null, clientSecret ? String(clientSecret).trim() : null,
          String(merchantId).trim(), String(accountPhone).trim(), String(accountRif).trim(),
          Boolean(autoApprove)
        ]
      );
    }
    recordUsage(req.client.tenant_id, "API_CALL", "/api/bank/config", 0, 0);
    res.json({ success: true, config: sanitizeBankConfig(saved.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/bank/verify-payment", requireAuth, async (req, res) => {
  const started = Date.now();
  try {
    const cfg = await resolveEffectiveBankConfig(req.client.tenant_id);
    const result = await verifyBankPayment(cfg, req.body || {});
    recordUsage(req.client.tenant_id, "BANK_VERIFY", "/api/bank/verify-payment", 0, Date.now() - started);
    await pool
      .query(
        `INSERT INTO operation_logs (id, tenant_id, operation, description, metadata, created_at)
         VALUES ($1, $2, 'BANK_PAYMENT_VERIFY', $3, $4::jsonb, NOW())`,
        [uuidv4(), req.client.tenant_id, result.message, JSON.stringify(result)]
      )
      .catch(() => {});
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/payments/confirm", requireAuth, async (req, res) => {
  const { planTier = "PRO", reference, originBank = "Mercantil (0105)", amountUsd = 49, amountBs = 0 } = req.body || {};
  if (!reference || String(reference).trim().length < 4) {
    return res.status(400).json({ success: false, error: "Referencia de pago inválida." });
  }
  const safePlan = ["ESTANDAR", "PRO", "GOLD"].includes(String(planTier).toUpperCase())
    ? String(planTier).toUpperCase()
    : "PRO";
  const prismaPlan = safePlan === "ESTANDAR" ? "LITE" : "PRO";

  const globalBank = await pool.query(`SELECT * FROM bank_integrations WHERE scope = 'GLOBAL' LIMIT 1`);
  const bankCheck = await verifyBankPayment(globalBank.rows[0] || null, {
    reference, amountUsd, amountBs, payerPhone: req.client.phone
  });

  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const updated = await db.query(
      `UPDATE web_clients SET plan_tier = $1, payment_status = 'PAID', payment_reference = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [safePlan, String(reference).trim(), req.client.id]
    );
    await db.query(`UPDATE tenants SET plan = $1::"PlanType", updated_at = NOW() WHERE id = $2`, [
      prismaPlan, req.client.tenant_id
    ]);
    await db
      .query(
        `INSERT INTO operation_logs (id, tenant_id, operation, description, metadata, created_at)
         VALUES ($1, $2, 'PLAN_PAYMENT_REGISTERED', $3, $4::jsonb, NOW())`,
        [
          uuidv4(), req.client.tenant_id,
          `Pago Móvil Plan ${safePlan} Ref #${String(reference).trim()} (${bankCheck.status})`,
          JSON.stringify({ planTier: safePlan, originBank, amountUsd, reference, bankCheck })
        ]
      )
      .catch(() => {});
    await db.query("COMMIT");
    recordUsage(req.client.tenant_id, "API_CALL", "/api/payments/confirm", 0, 0);
    return res.json({ success: true, client: sanitizeClient(updated.rows[0]), bankVerification: bankCheck });
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    return res.status(500).json({ success: false, error: err.message });
  } finally {
    db.release();
  }
});

// ============================================================================
// 3. INVENTARIO DEL CLIENTE (NEON `products` + `stocks`)
// ============================================================================
async function upsertProductsForTenant(tenantId, items) {
  const db = await pool.connect();
  let imported = 0;
  try {
    await db.query("BEGIN");
    const branchId = await ensureMainBranch(db, tenantId);
    for (const raw of items) {
      const name = String(raw.name || "").trim();
      const price = Number(raw.price);
      const quantity = Math.max(0, parseInt(raw.quantity, 10) || 0);
      if (!name || !Number.isFinite(price) || price <= 0) continue;

      const sku =
        String(raw.sku || "").trim() ||
        `SKU-${name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)}-${Math.floor(100 + Math.random() * 900)}`;
      const activeIngredient = String(raw.activeIngredient || raw.category || "GENERAL").trim();
      const laboratory = String(raw.laboratory || raw.brand || "Catálogo Cliente").trim();
      const presentation = String(raw.presentation || "Unidad").trim();
      const description = raw.description ? String(raw.description).trim() : null;
      const origin = ["NATIONAL", "INDIAN", "IMPORTED_OTHER"].includes(String(raw.origin || "").toUpperCase())
        ? String(raw.origin).toUpperCase()
        : "NATIONAL";

      const existing = await db.query(
        `SELECT id FROM products WHERE sku = $1 AND tenant_id = $2 LIMIT 1`,
        [sku, tenantId]
      );
      let productId;
      if (existing.rows.length > 0) {
        productId = existing.rows[0].id;
        await db.query(
          `UPDATE products
           SET name = $1, description = $2, active_ingredient = $3, laboratory = $4,
               presentation = $5, origin = $6::"MedicineOrigin", base_price = $7,
               is_active = true, updated_at = NOW()
           WHERE id = $8`,
          [name, description, activeIngredient, laboratory, presentation, origin, price, productId]
        );
      } else {
        productId = uuidv4();
        await db.query(
          `INSERT INTO products
            (id, sku, name, description, active_ingredient, laboratory, presentation, origin,
             is_national_distribution, base_price, is_active, tenant_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"MedicineOrigin", true, $9, true, $10, NOW(), NOW())`,
          [productId, sku, name, description, activeIngredient, laboratory, presentation, origin, price, tenantId]
        );
      }

      const stockRow = await db.query(
        `SELECT id FROM stocks WHERE product_id = $1 AND branch_id = $2 LIMIT 1`,
        [productId, branchId]
      );
      if (stockRow.rows.length > 0) {
        await db.query(`UPDATE stocks SET quantity = $1, updated_at = NOW() WHERE id = $2`, [
          quantity, stockRow.rows[0].id
        ]);
      } else {
        await db.query(
          `INSERT INTO stocks (id, product_id, branch_id, quantity, min_qty, updated_at)
           VALUES ($1, $2, $3, $4, 5, NOW())`,
          [uuidv4(), productId, branchId, quantity]
        );
      }
      imported += 1;
    }
    await db.query("COMMIT");
    return imported;
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    db.release();
  }
}

function parseCsvInventory(csvText) {
  const lines = String(csvText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const firstCols = lines[0].toLowerCase();
  const hasHeader = firstCols.includes("sku") || firstCols.includes("nombre") || firstCols.includes("name") || firstCols.includes("precio");
  const items = [];
  for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 3) continue;
    items.push({
      sku: cols[0],
      name: cols[1],
      price: Number(String(cols[2]).replace(",", ".")),
      quantity: parseInt(cols[3] || "1", 10),
      activeIngredient: cols[4] || "GENERAL",
      presentation: cols[5] || "Unidad",
      laboratory: cols[6] || "Catálogo Cliente"
    });
  }
  return items;
}

app.get("/api/inventory", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.sku, p.name, p.description, p.active_ingredient, p.laboratory,
              p.presentation, p.origin, p.base_price, p.is_active,
              COALESCE(SUM(s.quantity), 0)::int AS quantity
       FROM products p LEFT JOIN stocks s ON s.product_id = p.id
       WHERE p.tenant_id = $1 AND p.is_active = true
       GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 300`,
      [req.client.tenant_id]
    );
    recordUsage(req.client.tenant_id, "API_CALL", "/api/inventory", 0, 0);
    res.json({
      success: true,
      items: result.rows.map((r) => ({
        id: r.id, sku: r.sku, name: r.name, description: r.description || "",
        activeIngredient: r.active_ingredient, laboratory: r.laboratory,
        presentation: r.presentation, origin: r.origin,
        price: Number(r.base_price), quantity: Number(r.quantity)
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/inventory", requireAuth, async (req, res) => {
  try {
    const count = await upsertProductsForTenant(req.client.tenant_id, [req.body]);
    if (!count) return res.status(400).json({ success: false, error: "Indica al menos nombre y precio mayor a 0." });
    recordUsage(req.client.tenant_id, "API_CALL", "/api/inventory", 0, 0);
    res.status(201).json({ success: true, imported: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(["/api/inventory/bulk", "/api/v1/stock/import"], requireAuth, async (req, res) => {
  try {
    const { items, csvText, rawText } = req.body || {};
    let parsed = Array.isArray(items) ? items : [];
    if (!parsed.length && (csvText || rawText)) parsed = parseCsvInventory(csvText || rawText);
    if (!parsed.length) {
      return res.status(400).json({ success: false, error: "Formato CSV esperado: sku,nombre,precio,stock,categoria,presentacion" });
    }
    const imported = await upsertProductsForTenant(req.client.tenant_id, parsed);
    recordUsage(req.client.tenant_id, "API_CALL", req.path, 0, 0);
    res.status(201).json({ success: true, imported, message: `${imported} productos guardados en Neon y asimilados por el Bot.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/inventory/:productId", requireAuth, async (req, res) => {
  try {
    await pool.query(`UPDATE products SET is_active = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [
      req.params.productId, req.client.tenant_id
    ]);
    recordUsage(req.client.tenant_id, "API_CALL", "/api/inventory/delete", 0, 0);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 4. CONTROL DEL BOT EMBEBIDO (100% INDEPENDIENTE — SIN LINK EXTERNO)
// ============================================================================
app.get(["/api/bot/status", "/api/v1/bot/status"], requireAuth, async (req, res) => {
  const wa = whatsappBot.getState();
  res.json({
    success: true,
    data: {
      botEnabled: Boolean(req.client.bot_enabled),
      engineActive: wa.active,
      standalone: true,
      waStatus: wa.status,
      qrBase64: wa.qrBase64,
      lastError: wa.lastError,
      botName: req.client.bot_name || process.env.BOT_NAME || "Max",
      whatsappPhone: wa.connectedPhone || req.client.whatsapp_phone || process.env.WHATSAPP_BOT_NUMBER || "+584166214410",
      businessHours: req.client.business_hours,
      deliveryInfo: req.client.delivery_info
    }
  });
});

app.get("/api/v1/bot/qr", requireAuth, (_req, res) => {
  const wa = whatsappBot.getState();
  res.json({ success: true, data: { status: wa.status, qrBase64: wa.qrBase64 } });
});

app.post(["/api/bot/toggle", "/api/v1/bot/toggle"], requireAuth, async (req, res) => {
  try {
    const requested = req.body && typeof req.body.active === "boolean" ? req.body.active : !req.client.bot_enabled;
    const updated = await pool.query(
      `UPDATE web_clients SET bot_enabled = $1, updated_at = NOW() WHERE id = $2 RETURNING bot_enabled`,
      [requested, req.client.id]
    );
    await pool.query(`UPDATE tenants SET whatsapp_enabled = $1, updated_at = NOW() WHERE id = $2`, [
      requested, req.client.tenant_id
    ]);
    whatsappBot.setActive(requested);
    recordUsage(req.client.tenant_id, "API_CALL", req.path, 0, 0);
    res.json({ success: true, botEnabled: updated.rows[0].bot_enabled, standaloneSynced: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(["/api/bot/restart", "/api/v1/bot/restart"], requireAuth, async (req, res) => {
  try {
    const wa = await whatsappBot.restart();
    recordUsage(req.client.tenant_id, "API_CALL", req.path, 0, 0);
    res.json({ success: true, data: wa });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post(["/api/bot/pairing-code", "/api/v1/bot/pairing-code"], requireAuth, async (req, res) => {
  try {
    const phone = (req.body && req.body.phone) || req.client.whatsapp_phone || "";
    const data = await whatsappBot.requestPairingCode(phone);
    recordUsage(req.client.tenant_id, "API_CALL", req.path, 0, 0);
    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put("/api/bot/settings", requireAuth, async (req, res) => {
  try {
    const { botName, businessName, whatsappPhone, businessHours, deliveryInfo, businessType } = req.body || {};
    const updated = await pool.query(
      `UPDATE web_clients
       SET bot_name = COALESCE($1, bot_name),
           business_name = COALESCE($2, business_name),
           whatsapp_phone = COALESCE($3, whatsapp_phone),
           business_hours = COALESCE($4, business_hours),
           delivery_info = COALESCE($5, delivery_info),
           business_type = COALESCE($6, business_type),
           updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        botName ? String(botName).trim() : null,
        businessName ? String(businessName).trim() : null,
        whatsappPhone ? String(whatsappPhone).trim() : null,
        businessHours ? String(businessHours).trim() : null,
        deliveryInfo ? String(deliveryInfo).trim() : null,
        businessType ? String(businessType).toUpperCase() : null,
        req.client.id
      ]
    );
    await pool.query(`UPDATE tenants SET name = $1, whatsapp_phone = $2, updated_at = NOW() WHERE id = $3`, [
      updated.rows[0].business_name, updated.rows[0].whatsapp_phone, req.client.tenant_id
    ]);
    recordUsage(req.client.tenant_id, "API_CALL", "/api/bot/settings", 0, 0);
    res.json({ success: true, client: sanitizeClient(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Chat interno del Dashboard
app.post("/api/bot/chat", requireAuth, async (req, res) => {
  try {
    const message = String((req.body && req.body.message) || "").trim();
    if (!message) return res.status(400).json({ success: false, error: "Escribe un mensaje." });
    const out = await generateInventoryBotReply(req.client, message, "/api/bot/chat");
    res.json({ success: true, reply: out.reply, source: out.source });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// 5. API PÚBLICA SAAS (/api/v1/chatbot/*) — 100% EMBEBIDA EN ESTE SERVIDOR
// ============================================================================
app.post("/api/v1/chatbot/message", requireAuth, async (req, res) => {
  try {
    const message = String((req.body && req.body.message) || "").trim();
    if (!message) return res.status(400).json({ success: false, error: { message: "message requerido" } });
    const out = await generateInventoryBotReply(req.client, message, "/api/v1/chatbot/message");
    const convId = (req.body && req.body.conversation_id) || uuidv4();
    const queryId = uuidv4();
    await pool
      .query(
        `INSERT INTO operation_logs (id, tenant_id, operation, description, metadata, created_at)
         VALUES ($1, $2, 'CHATBOT_QUERY', $3, $4::jsonb, NOW())`,
        [
          queryId, req.client.tenant_id, message.slice(0, 120),
          JSON.stringify({ conversation_id: convId, question: message, response: out.reply, source: out.source })
        ]
      )
      .catch(() => {});

    res.json({
      success: true,
      data: { response: out.reply, state: "ACTIVE", conversation_id: convId, query_id: queryId, source: out.source }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get("/api/v1/chatbot/conversations", requireAuth, async (req, res) => {
  try {
    const logs = await pool.query(
      `SELECT id, description, metadata, created_at FROM operation_logs
       WHERE tenant_id = $1 AND operation = 'CHATBOT_QUERY'
       ORDER BY created_at DESC LIMIT 30`,
      [req.client.tenant_id]
    );
    res.json({
      success: true,
      data: logs.rows.map((r) => ({
        id: r.id,
        customer_name: req.client.business_name,
        title: r.description,
        state: "ACTIVE",
        updated_at: r.created_at
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post("/api/v1/chatbot/rate/:queryId", requireAuth, async (req, res) => {
  try {
    const helpful = Boolean(req.body && req.body.helpful);
    await pool.query(
      `UPDATE operation_logs SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2 AND tenant_id = $3`,
      [JSON.stringify({ was_helpful: helpful }), req.params.queryId, req.client.tenant_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post("/api/v1/chatbot/api-keys/generate", requireAuth, async (req, res) => {
  const { name, email, plan = "PRO", business_type = "RETAIL", whatsapp_phone } = req.body || {};
  if (!name || !email) return res.status(400).json({ success: false, error: { message: "name y email requeridos" } });

  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const normEmail = String(email).trim().toLowerCase();
    const existing = await db.query(`SELECT * FROM web_clients WHERE email = $1 LIMIT 1`, [normEmail]);
    let row;
    if (existing.rows.length) {
      row = existing.rows[0];
    } else {
      row = await createAccountInDb(db, {
        fullName: name,
        businessName: name,
        businessType: business_type,
        email: normEmail,
        phone: whatsapp_phone || "",
        password: crypto.randomBytes(12).toString("hex"),
        planTier: String(plan).toUpperCase() === "LITE" ? "ESTANDAR" : "PRO",
        paymentStatus: "PAID"
      });
    }
    await db.query("COMMIT");
    res.status(201).json({
      success: true,
      data: {
        tenantId: row.tenant_id,
        name: row.business_name,
        email: row.email,
        businessType: row.business_type,
        plan: row.plan_tier,
        apiKey: row.api_key
      }
    });
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    res.status(500).json({ success: false, error: { message: err.message } });
  } finally {
    db.release();
  }
});

// ============================================================================
// 6. PANEL SUPERADMIN
// ============================================================================
app.get("/api/admin/overview", requireAuth, requireSuperadmin, async (_req, res) => {
  try {
    const [companiesRes, dailyRes, logsRes, globalBankRes] = await Promise.all([
      pool.query(`
        SELECT
          wc.id, wc.tenant_id, wc.full_name, wc.business_name, wc.business_type, wc.email,
          wc.phone, wc.role, wc.is_active, wc.plan_tier, wc.payment_status, wc.bot_enabled,
          wc.api_key, wc.created_at,
          COALESCE(p_agg.product_count, 0)::int AS product_count,
          COALESCE(u_agg.api_calls, 0)::int AS api_calls,
          (COALESCE(u_agg.chatbot_msgs, 0) + COALESCE(o_agg.bot_queries, 0))::int AS chatbot_msgs,
          COALESCE(u_agg.bank_verifies, 0)::int AS bank_verifies,
          COALESCE(u_agg.tokens_used, 0)::int AS tokens_used
        FROM web_clients wc
        LEFT JOIN (
          SELECT tenant_id, COUNT(*)::int AS product_count FROM products WHERE is_active = true GROUP BY tenant_id
        ) p_agg ON p_agg.tenant_id = wc.tenant_id
        LEFT JOIN (
          SELECT tenant_id,
            COUNT(*) FILTER (WHERE metric_type = 'API_CALL')::int AS api_calls,
            COUNT(*) FILTER (WHERE metric_type = 'CHATBOT_MSG')::int AS chatbot_msgs,
            COUNT(*) FILTER (WHERE metric_type = 'BANK_VERIFY')::int AS bank_verifies,
            COALESCE(SUM(tokens_used), 0)::int AS tokens_used
          FROM usage_metrics GROUP BY tenant_id
        ) u_agg ON u_agg.tenant_id = wc.tenant_id
        LEFT JOIN (
          SELECT tenant_id, COUNT(*)::int AS bot_queries FROM operation_logs WHERE operation = 'CHATBOT_QUERY' GROUP BY tenant_id
        ) o_agg ON o_agg.tenant_id = wc.tenant_id
        ORDER BY (COALESCE(u_agg.api_calls, 0) + COALESCE(u_agg.chatbot_msgs, 0) + COALESCE(o_agg.bot_queries, 0)) DESC, wc.created_at DESC
      `),
      pool.query(`
        SELECT
          TO_CHAR(d.day, 'DD/MM') AS label,
          COALESCE(COUNT(um.id) FILTER (WHERE um.metric_type = 'API_CALL'), 0)::int AS api_calls,
          COALESCE(COUNT(um.id) FILTER (WHERE um.metric_type = 'CHATBOT_MSG'), 0)::int AS chatbot_msgs
        FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
        LEFT JOIN usage_metrics um ON DATE(um.created_at) = DATE(d.day)
        GROUP BY d.day ORDER BY d.day ASC
      `),
      pool.query(`
        SELECT ol.id, ol.operation, ol.description, ol.created_at, t.name AS tenant_name
        FROM operation_logs ol LEFT JOIN tenants t ON t.id = ol.tenant_id
        ORDER BY ol.created_at DESC LIMIT 25
      `),
      pool.query(`SELECT * FROM bank_integrations WHERE scope = 'GLOBAL' LIMIT 1`)
    ]);

    const companies = companiesRes.rows.map((r) => ({
      id: r.id, tenantId: r.tenant_id, fullName: r.full_name, businessName: r.business_name,
      businessType: r.business_type, email: r.email, phone: r.phone, role: r.role,
      isActive: r.is_active !== false, planTier: r.plan_tier, paymentStatus: r.payment_status,
      botEnabled: r.bot_enabled, apiKey: r.api_key, productCount: r.product_count,
      apiCalls: r.api_calls, chatbotMsgs: r.chatbot_msgs, bankVerifies: r.bank_verifies,
      tokensUsed: r.tokens_used, totalUsage: r.api_calls + r.chatbot_msgs + r.bank_verifies,
      createdAt: r.created_at
    }));

    const totals = companies.reduce(
      (acc, c) => {
        acc.totalUsers += 1;
        if (c.role === "SUPERADMIN") acc.superadmins += 1;
        if (c.botEnabled && c.isActive) acc.activeBots += 1;
        acc.totalApiCalls += c.apiCalls;
        acc.totalChatbotMsgs += c.chatbotMsgs;
        acc.totalProducts += c.productCount;
        acc.plans[c.planTier] = (acc.plans[c.planTier] || 0) + 1;
        return acc;
      },
      { totalUsers: 0, superadmins: 0, activeBots: 0, totalApiCalls: 0, totalChatbotMsgs: 0, totalProducts: 0, plans: { ESTANDAR: 0, PRO: 0, GOLD: 0 } }
    );

    res.json({
      success: true, totals, companies,
      dailyTrend: dailyRes.rows, recentLogs: logsRes.rows,
      globalBank: sanitizeBankConfig(globalBankRes.rows[0] || null),
      bankProviders: BANK_PROVIDERS
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/users", requireAuth, requireSuperadmin, async (req, res) => {
  const {
    fullName, businessName, businessType = "RETAIL", email, phone = "",
    password, confirmPassword, role = "USER", planTier = "PRO", paymentStatus = "PAID"
  } = req.body || {};

  if (!fullName || !businessName || !email || !password) {
    return res.status(400).json({ success: false, error: "Completa nombre, empresa, correo y contraseña." });
  }
  if (String(password).length < 6) return res.status(400).json({ success: false, error: "Mínimo 6 caracteres." });
  if (typeof confirmPassword !== "undefined" && String(password) !== String(confirmPassword)) {
    return res.status(400).json({ success: false, error: "Las contraseñas no coinciden." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const exists = await db.query(`SELECT id FROM web_clients WHERE email = $1 LIMIT 1`, [normalizedEmail]);
    if (exists.rows.length) {
      await db.query("ROLLBACK");
      return res.status(409).json({ success: false, error: "Ese correo ya está registrado." });
    }
    const row = await createAccountInDb(db, {
      fullName, businessName, businessType, email: normalizedEmail, phone, password, role, planTier, paymentStatus
    });
    await db
      .query(
        `INSERT INTO operation_logs (id, tenant_id, operation, description, metadata, created_at)
         VALUES ($1, $2, 'ADMIN_USER_CREATED', $3, $4::jsonb, NOW())`,
        [uuidv4(), req.client.tenant_id, `Superadmin creó ${row.role}: ${row.email}`, JSON.stringify({ role: row.role, planTier: row.plan_tier })]
      )
      .catch(() => {});
    await db.query("COMMIT");
    res.status(201).json({ success: true, user: sanitizeClient(row) });
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    res.status(500).json({ success: false, error: err.message });
  } finally {
    db.release();
  }
});

app.patch("/api/admin/users/:id", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const targetId = req.params.id;
    const { role, isActive, planTier, paymentStatus, botEnabled, newPassword } = req.body || {};
    const targetRes = await pool.query(`SELECT * FROM web_clients WHERE id = $1 LIMIT 1`, [targetId]);
    if (!targetRes.rows.length) return res.status(404).json({ success: false, error: "Usuario no encontrado." });
    const target = targetRes.rows[0];

    if (target.id === req.client.id && isActive === false) return res.status(400).json({ success: false, error: "No puedes suspender tu propia cuenta." });
    if (target.id === req.client.id && role && role !== "SUPERADMIN") return res.status(400).json({ success: false, error: "No puedes quitarte el rol Superadmin." });

    const nextRole = role ? (String(role).toUpperCase() === "SUPERADMIN" ? "SUPERADMIN" : "USER") : target.role;
    const nextActive = typeof isActive === "boolean" ? isActive : target.is_active;
    const nextPlan = planTier && ["ESTANDAR", "PRO", "GOLD"].includes(String(planTier).toUpperCase()) ? String(planTier).toUpperCase() : target.plan_tier;
    const nextPay = paymentStatus ? String(paymentStatus).toUpperCase() : target.payment_status;
    const nextBot = typeof botEnabled === "boolean" ? botEnabled : target.bot_enabled;
    const nextPassHash = newPassword && String(newPassword).length >= 6 ? await hashPassword(String(newPassword)) : target.password_hash;

    const updated = await pool.query(
      `UPDATE web_clients SET role = $1, is_active = $2, plan_tier = $3, payment_status = $4,
       bot_enabled = $5, password_hash = $6, updated_at = NOW() WHERE id = $7 RETURNING *`,
      [nextRole, nextActive, nextPlan, nextPay, nextBot, nextPassHash, targetId]
    );
    await pool.query(`UPDATE tenants SET plan = $1::"PlanType", whatsapp_enabled = $2, updated_at = NOW() WHERE id = $3`, [
      nextPlan === "ESTANDAR" ? "LITE" : "PRO", nextBot, target.tenant_id
    ]);
    res.json({ success: true, user: sanitizeClient(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/admin/users/:id/rotate-key", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const targetRes = await pool.query(`SELECT * FROM web_clients WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (!targetRes.rows.length) return res.status(404).json({ success: false, error: "Usuario no encontrado." });
    const target = targetRes.rows[0];
    const newSecret = crypto.randomBytes(32).toString("hex");
    const newKey = generateTenantApiKey(target.tenant_id, newSecret);
    await pool.query(`UPDATE tenants SET webhook_secret = $1, updated_at = NOW() WHERE id = $2`, [newSecret, target.tenant_id]);
    const updated = await pool.query(`UPDATE web_clients SET api_key = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [newKey, target.id]);
    res.json({ success: true, user: sanitizeClient(updated.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/admin/users/:id", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    if (req.params.id === req.client.id) return res.status(400).json({ success: false, error: "No puedes eliminar tu propia cuenta." });
    const target = await pool.query(`SELECT tenant_id, email FROM web_clients WHERE id = $1 LIMIT 1`, [req.params.id]);
    if (!target.rows.length) return res.status(404).json({ success: false, error: "Usuario no encontrado." });
    await pool.query(`DELETE FROM tenants WHERE id = $1`, [target.rows[0].tenant_id]);
    res.json({ success: true, deletedEmail: target.rows[0].email });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/admin/bank-global", requireAuth, requireSuperadmin, async (req, res) => {
  try {
    const {
      provider = "MERCANTIL", verificationMode = "MANUAL", apiBaseUrl = "", apiKey, clientSecret,
      merchantId = "", accountPhone = "", accountRif = "", autoApprove = true
    } = req.body || {};
    const safeProvider = BANK_PROVIDERS[String(provider).toUpperCase()] ? String(provider).toUpperCase() : "MERCANTIL";
    const safeMode = ["MANUAL", "BANK_API", "SIMULATED"].includes(String(verificationMode).toUpperCase())
      ? String(verificationMode).toUpperCase()
      : "MANUAL";

    const existing = await pool.query(`SELECT * FROM bank_integrations WHERE scope = 'GLOBAL' LIMIT 1`);
    let saved;
    if (existing.rows.length) {
      saved = await pool.query(
        `UPDATE bank_integrations
         SET provider = $1, verification_mode = $2, api_base_url = $3,
             api_key = COALESCE(NULLIF($4, ''), api_key),
             client_secret = COALESCE(NULLIF($5, ''), client_secret),
             merchant_id = $6, account_phone = $7, account_rif = $8,
             auto_approve = $9, updated_at = NOW()
         WHERE id = $10 RETURNING *`,
        [
          safeProvider, safeMode, String(apiBaseUrl).trim(),
          apiKey ? String(apiKey).trim() : "", clientSecret ? String(clientSecret).trim() : "",
          String(merchantId).trim(), String(accountPhone).trim(), String(accountRif).trim(),
          Boolean(autoApprove), existing.rows[0].id
        ]
      );
    } else {
      saved = await pool.query(
        `INSERT INTO bank_integrations
          (id, tenant_id, scope, provider, verification_mode, api_base_url, api_key, client_secret,
           merchant_id, account_phone, account_rif, auto_approve, updated_at)
         VALUES ($1, NULL, 'GLOBAL', $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
        [
          uuidv4(), safeProvider, safeMode, String(apiBaseUrl).trim(),
          apiKey ? String(apiKey).trim() : null, clientSecret ? String(clientSecret).trim() : null,
          String(merchantId).trim(), String(accountPhone).trim(), String(accountRif).trim(), Boolean(autoApprove)
        ]
      );
    }
    res.json({ success: true, config: sanitizeBankConfig(saved.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// SERVIR FRONTEND ESTÁTICO (BLOQUEANDO ARCHIVOS SENSIBLES)
// ============================================================================
const STATIC_ROOT = path.resolve(__dirname, "..");

app.use((req, res, next) => {
  const lower = req.path.toLowerCase();
  if (
    lower.startsWith("/.env") ||
    lower.startsWith("/server") ||
    lower.startsWith("/db") ||
    lower.startsWith("/node_modules") ||
    lower.startsWith("/.wwebjs") ||
    lower.includes("package.json") ||
    lower.includes("package-lock.json") ||
    lower.includes("dockerfile")
  ) {
    return res.status(403).send("Forbidden");
  }
  next();
});

app.use(express.static(STATIC_ROOT));

// ============================================================================
// ARRANQUE RESILIENTE (NUNCA ENTRA EN CRASH-LOOP EN RAILWAY)
// ============================================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Server] Ckekea Standalone escuchando en http://0.0.0.0:${PORT}`);

  ensureSchemaAndSeed()
    .then(() => {
      // Iniciar bot WhatsApp embebido en segundo plano
      whatsappBot.initialize().catch((err) => {
        console.warn("[WhatsAppBot] Inicio diferido:", err.message);
      });
    })
    .catch((err) => {
      dbReady = false;
      dbLastError = err.message;
      console.error("[DB] Error conectando a Neon (el servidor web sigue activo):", err.message);
    });
});
