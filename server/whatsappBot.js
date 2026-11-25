/**
 * ============================================================================
 * CKEKEA — MOTOR INDEPENDIENTE DE WHATSAPP BOT (whatsapp-web.js + QR + PAIRING)
 * ============================================================================
 * Corre 100% embebido dentro de este mismo servidor Railway sin depender de
 * ningún enlace externo. Tolerante a fallos: si Chromium no está instalado en
 * local o WHATSAPP_ENABLED=false, el servidor web sigue funcionando sin caerse.
 */

"use strict";

const fs = require("fs");

function detectChromiumPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ].filter(Boolean);
  return candidates.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

class StandaloneWhatsAppBot {
  constructor() {
    this.client = null;
    this.active = true;
    this.status = "DISABLED"; // DISABLED | INITIALIZING | QR_READY | READY | DISCONNECTED | ERROR
    this.qrRaw = null;
    this.qrBase64 = null;
    this.lastError = null;
    this.connectedPhone = null;
    this.sessionPath = process.env.WHATSAPP_SESSION_PATH || ".wwebjs_auth";
    this.messageHandler = null;
    this.initializing = false;
  }

  setMessageHandler(fn) {
    this.messageHandler = fn;
  }

  setActive(nextState) {
    this.active = Boolean(nextState);
    return this.active;
  }

  getState() {
    return {
      active: this.active,
      status: this.status,
      qrBase64: this.qrBase64,
      connectedPhone: this.connectedPhone,
      sessionPath: this.sessionPath,
      lastError: this.lastError
    };
  }

  async initialize() {
    if (process.env.WHATSAPP_ENABLED === "false") {
      this.status = "DISABLED";
      return;
    }
    if (this.initializing) return;
    this.initializing = true;
    this.lastError = null;

    let wwebjs;
    let QRCode;
    try {
      wwebjs = require("whatsapp-web.js");
      QRCode = require("qrcode");
    } catch (err) {
      this.status = "ERROR";
      this.lastError = "Paquetes whatsapp-web.js/qrcode no instalados todavía (" + err.message + ")";
      this.initializing = false;
      console.warn("[WhatsAppBot]", this.lastError);
      return;
    }

    const executablePath = detectChromiumPath();
    if (!executablePath && process.env.NODE_ENV !== "production") {
      this.status = "DISCONNECTED";
      this.lastError = "Chromium no detectado en este equipo local. En Railway (Dockerfile) se activa automáticamente.";
      this.initializing = false;
      console.log("[WhatsAppBot]", this.lastError);
      return;
    }

    this.status = "INITIALIZING";
    this.qrRaw = null;
    this.qrBase64 = null;

    try {
      const { Client, LocalAuth } = wwebjs;
      const puppeteerOpts = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu"
        ]
      };
      if (executablePath) puppeteerOpts.executablePath = executablePath;

      this.client = new Client({
        authStrategy: new LocalAuth({
          clientId: "ckekea-standalone-max",
          dataPath: this.sessionPath
        }),
        puppeteer: puppeteerOpts
      });

      this.client.on("qr", async (qr) => {
        this.qrRaw = qr;
        this.status = "QR_READY";
        this.lastError = null;
        try {
          this.qrBase64 = await QRCode.toDataURL(qr);
        } catch {
          this.qrBase64 = null;
        }
        console.log("[WhatsAppBot] Nuevo código QR listo en el Dashboard.");
      });

      this.client.on("ready", () => {
        this.status = "READY";
        this.qrRaw = null;
        this.qrBase64 = null;
        this.lastError = null;
        try {
          this.connectedPhone =
            (this.client.info && this.client.info.wid && this.client.info.wid.user) ||
            process.env.WHATSAPP_BOT_NUMBER ||
            null;
        } catch {
          this.connectedPhone = process.env.WHATSAPP_BOT_NUMBER || null;
        }
        console.log("[WhatsAppBot] WhatsApp conectado y listo:", this.connectedPhone);
      });

      this.client.on("authenticated", () => {
        console.log("[WhatsAppBot] Sesión autenticada correctamente.");
      });

      this.client.on("auth_failure", (msg) => {
        this.status = "ERROR";
        this.lastError = "Fallo de autenticación WhatsApp: " + msg;
        console.error("[WhatsAppBot]", this.lastError);
      });

      this.client.on("disconnected", (reason) => {
        this.status = "DISCONNECTED";
        this.connectedPhone = null;
        this.lastError = "Desconectado: " + reason;
        console.warn("[WhatsAppBot] Desconectado:", reason);
      });

      this.client.on("message", async (msg) => {
        try {
          if (!this.active) return;
          if (!msg || msg.fromMe) return;
          if (msg.from.endsWith("@g.us") || msg.from === "status@broadcast") return;
          if (!this.messageHandler) return;

          const phone = msg.from.replace(/@.+$/, "");
          const notifyName = (msg._data && msg._data.notifyName) || "Cliente";
          const replyText = await this.messageHandler({
            phone,
            customerName: notifyName,
            text: String(msg.body || "").trim()
          });

          if (replyText && this.client) {
            await this.client.sendMessage(msg.from, replyText);
          }
        } catch (err) {
          console.error("[WhatsAppBot] Error respondiendo mensaje:", err.message);
        }
      });

      this.client.initialize().catch((err) => {
        this.status = "ERROR";
        this.lastError = err.message;
        console.error("[WhatsAppBot] Error inicializando Puppeteer/WhatsApp:", err.message);
      });
    } catch (err) {
      this.status = "ERROR";
      this.lastError = err.message;
      console.error("[WhatsAppBot] Error creando cliente:", err.message);
    } finally {
      this.initializing = false;
    }
  }

  async requestPairingCode(phoneRaw) {
    const cleanPhone = String(phoneRaw || "").replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Número inválido. Usa formato internacional sin +, ej: 584166214410.");
    }
    if (!this.client || typeof this.client.requestPairingCode !== "function") {
      throw new Error("El motor de WhatsApp aún está inicializando o no soporta código en este estado. Escanea el QR en pantalla.");
    }
    const code = await this.client.requestPairingCode(cleanPhone);
    return { phone: cleanPhone, pairingCode: code };
  }

  async restart() {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch {
        // silencioso
      }
      this.client = null;
    }
    this.status = "DISCONNECTED";
    this.qrBase64 = null;
    this.qrRaw = null;
    this.initializing = false;
    await this.initialize();
    return this.getState();
  }
}

module.exports = new StandaloneWhatsAppBot();
