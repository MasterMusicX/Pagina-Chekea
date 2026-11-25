/**
 * ============================================================================
 * CKEKEA — ADAPTADOR MODULAR DE APIs BANCARIAS VENEZUELA (PLUG & PLAY)
 * ============================================================================
 * Deja lista la validación automática de Pago Móvil para cuando el banco
 * otorgue credenciales de producción:
 *   - Banco Mercantil (0105)
 *   - Banco de Venezuela / BDV (0102)
 *   - Banesco (0134)
 *   - Banco Nacional de Crédito / BNC (0191)
 *   - Bancamiga (0172)
 *   - Endpoint Bancario Personalizado (CUSTOM)
 *
 * Modos soportados:
 *   - MANUAL:    registra el pago como pendiente para validación humana.
 *   - SIMULATED: aprueba automáticamente referencias válidas (>= 6 dígitos) para pruebas.
 *   - BANK_API:  invoca la API bancaria real con firma HMAC/Bearer y concilia monto + referencia.
 */

"use strict";

const crypto = require("crypto");
const fetch = require("node-fetch");

const BANK_PROVIDERS = {
  MERCANTIL: {
    code: "0105",
    name: "Banco Mercantil",
    defaultVerifyPath: "/v1/payments/c2p/verify",
    authHeader: "X-IBM-Client-Id"
  },
  BDV: {
    code: "0102",
    name: "Banco de Venezuela (BDV)",
    defaultVerifyPath: "/getMovement",
    authHeader: "X-API-Key"
  },
  BANESCO: {
    code: "0134",
    name: "Banesco",
    defaultVerifyPath: "/api/v1/pagomovil/conciliar",
    authHeader: "Authorization"
  },
  BNC: {
    code: "0191",
    name: "Banco Nacional de Crédito (BNC)",
    defaultVerifyPath: "/api/Position/ValidateP2P",
    authHeader: "X-API-Key"
  },
  BANCAMIGA: {
    code: "0172",
    name: "Bancamiga",
    defaultVerifyPath: "/v1/pagomovil/validar",
    authHeader: "Authorization"
  },
  CUSTOM: {
    code: "0000",
    name: "API Bancaria Personalizada",
    defaultVerifyPath: "/verify",
    authHeader: "Authorization"
  }
};

function maskSecret(val) {
  const s = String(val || "").trim();
  if (!s) return "";
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}••••••${s.slice(-4)}`;
}

/**
 * Ejecuta la validación de una transacción Pago Móvil según la configuración
 * bancaria del comercio (o la configuración global de Ckekea).
 */
async function verifyBankPayment(config, payment) {
  const mode = String((config && config.verification_mode) || process.env.PAYMENT_VERIFICATION_MODE || "MANUAL").toUpperCase();
  const providerKey = String((config && config.provider) || "MERCANTIL").toUpperCase();
  const provider = BANK_PROVIDERS[providerKey] || BANK_PROVIDERS.MERCANTIL;

  const cleanRef = String((payment && payment.reference) || "").replace(/\D/g, "");
  const amountBs = Number((payment && payment.amountBs) || 0);
  const amountUsd = Number((payment && payment.amountUsd) || 0);
  const payerPhone = String((payment && payment.payerPhone) || "").replace(/\D/g, "");
  const paymentDate = (payment && payment.paymentDate) || new Date().toISOString().slice(0, 10);

  if (cleanRef.length < 4) {
    return {
      verified: false,
      mode,
      provider: provider.name,
      status: "INVALID_REFERENCE",
      message: "La referencia bancaria debe contener al menos 4 dígitos numéricos."
    };
  }

  // Modo 1: SIMULATED (útil para demostraciones y QA antes de recibir credenciales del banco)
  if (mode === "SIMULATED") {
    const ok = cleanRef.length >= 6;
    return {
      verified: ok,
      mode: "SIMULATED",
      provider: provider.name,
      bankCode: provider.code,
      status: ok ? "APPROVED_SIMULATED" : "REJECTED_SIMULATED",
      reference: cleanRef,
      message: ok
        ? `Conciliación simulada aprobada en ${provider.name} (${provider.code}) · Ref #${cleanRef}.`
        : "En modo simulado la referencia debe tener al menos 6 dígitos."
    };
  }

  // Modo 2: MANUAL (alerta a caja / panel de administración)
  if (mode !== "BANK_API") {
    return {
      verified: false,
      mode: "MANUAL",
      provider: provider.name,
      bankCode: provider.code,
      status: "PENDING_MANUAL_REVIEW",
      reference: cleanRef,
      message: `Pago registrado en modo MANUAL (${provider.name}). Listo para aprobación en caja o activa modo BANK_API al recibir credenciales del banco.`
    };
  }

  // Modo 3: BANK_API (conexión real lista para Mercantil / BDV / Banesco / BNC)
  const baseUrl = String((config && config.api_base_url) || process.env.BANK_API_URL || "").trim().replace(/\/+$/, "");
  const apiKey = String((config && config.api_key) || process.env.BANK_API_KEY || "").trim();
  const clientSecret = String((config && config.client_secret) || "").trim();

  if (!baseUrl || !apiKey) {
    return {
      verified: false,
      mode: "BANK_API",
      provider: provider.name,
      bankCode: provider.code,
      status: "PENDING_CREDENTIALS",
      reference: cleanRef,
      message: `Faltan URL o API Key del banco (${provider.name}). Configúralas en el Panel Bancario cuando el banco te entregue acceso.`
    };
  }

  const endpoint = baseUrl.includes("/verify") || baseUrl.includes("/getMovement") || baseUrl.includes("/conciliar")
    ? baseUrl
    : `${baseUrl}${provider.defaultVerifyPath}`;

  const payload = {
    bankCode: provider.code,
    merchantId: (config && config.merchant_id) || undefined,
    destinationPhone: (config && config.account_phone) || process.env.PAYMENT_PHONE || "04246003606",
    destinationRif: (config && config.account_rif) || process.env.PAYMENT_RIF || "V-31091406",
    payerPhone,
    reference: cleanRef,
    amountBs,
    amountUsd,
    paymentDate
  };

  const bodyStr = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  if (provider.authHeader === "Authorization") {
    headers.Authorization = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  } else {
    headers[provider.authHeader] = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (clientSecret) {
    headers["X-Bank-Signature"] = crypto
      .createHmac("sha256", clientSecret)
      .update(bodyStr)
      .digest("hex");
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: bodyStr,
      timeout: 8000
    });
    const data = await res.json().catch(() => ({}));
    const approved = Boolean(
      res.ok &&
      (data.verified === true ||
        data.approved === true ||
        data.code === 1000 ||
        String(data.status || "").toUpperCase() === "APPROVED" ||
        String(data.status || "").toUpperCase() === "PAID")
    );

    return {
      verified: approved,
      mode: "BANK_API",
      provider: provider.name,
      bankCode: provider.code,
      httpStatus: res.status,
      status: approved ? "APPROVED_BANK_API" : "NOT_CONFIRMED_BY_BANK",
      reference: cleanRef,
      bankResponse: data,
      message: approved
        ? `Pago Móvil conciliado automáticamente con ${provider.name} (Ref #${cleanRef}).`
        : data.message || `El banco respondió HTTP ${res.status} sin confirmar la referencia #${cleanRef}.`
    };
  } catch (err) {
    return {
      verified: false,
      mode: "BANK_API",
      provider: provider.name,
      bankCode: provider.code,
      status: "BANK_UNREACHABLE",
      reference: cleanRef,
      message: `No se pudo contactar el endpoint bancario (${err.message}). El pago queda pendiente para revisión.`
    };
  }
}

module.exports = {
  BANK_PROVIDERS,
  maskSecret,
  verifyBankPayment
};
