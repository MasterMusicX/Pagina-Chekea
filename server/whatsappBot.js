/**
 * ============================================================================
 * CKEKEA — MOTOR INDEPENDIENTE DE WHATSAPP BOT (@whiskeysockets/baileys)
 * ============================================================================
 * Conexión directa por WebSocket nativo de WhatsApp (SIN Chromium ni Puppeteer):
 *  - Genera el código QR en ~2 segundos dentro de Railway (~30 MB RAM)
 *  - Soporta Pairing Code de 8 dígitos por número de teléfono
 *  - Persistencia de sesión en disco (WHATSAPP_SESSION_PATH)
 *  - Reconexión automática ante cortes temporales y reinicio limpio desde Dashboard
 */

"use strict";

const fs = require("fs");
const path = require("path");
const dns = require("dns");

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

function extractMessageText(messageObj) {
  if (!messageObj) return "";
  if (messageObj.conversation) return messageObj.conversation;
  if (messageObj.extendedTextMessage && messageObj.extendedTextMessage.text) {
    return messageObj.extendedTextMessage.text;
  }
  if (messageObj.imageMessage && messageObj.imageMessage.caption) {
    return messageObj.imageMessage.caption;
  }
  if (messageObj.documentMessage && messageObj.documentMessage.caption) {
    return messageObj.documentMessage.caption;
  }
  if (messageObj.buttonsResponseMessage && messageObj.buttonsResponseMessage.selectedDisplayText) {
    return messageObj.buttonsResponseMessage.selectedDisplayText;
  }
  if (messageObj.listResponseMessage && messageObj.listResponseMessage.title) {
    return messageObj.listResponseMessage.title;
  }
  return "";
}

class StandaloneWhatsAppBot {
  constructor() {
    this.sock = null;
    this.active = true;
    this.status = "DISABLED"; // DISABLED | INITIALIZING | QR_READY | READY | DISCONNECTED | ERROR
    this.qrRaw = null;
    this.qrBase64 = null;
    this.lastError = null;
    this.connectedPhone = null;
    this.sessionPath = path.resolve(process.env.WHATSAPP_SESSION_PATH || ".wwebjs_auth", "baileys_session");
    this.messageHandler = null;
    this.initializing = false;
    this.reconnectTimer = null;
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

  closeSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      const old = this.sock;
      this.sock = null;
      try {
        old.ev.removeAllListeners();
        if (old.ws) old.ws.close();
      } catch {
        // silencioso
      }
    }
  }

  async initialize(clearAuthFirst) {
    if (process.env.WHATSAPP_ENABLED === "false") {
      this.status = "DISABLED";
      return;
    }
    if (this.initializing) return;
    this.initializing = true;
    this.lastError = null;

    let baileys;
    let pino;
    let QRCode;
    try {
      baileys = require("@whiskeysockets/baileys");
      pino = require("pino");
      QRCode = require("qrcode");
    } catch (err) {
      this.status = "DISCONNECTED";
      this.lastError = "Baileys listo para ejecutarse en Node 20 (Railway): " + err.message;
      this.initializing = false;
      console.warn("[WhatsAppBot]", this.lastError);
      return;
    }

    this.closeSocket();
    this.status = "INITIALIZING";
    this.qrRaw = null;
    this.qrBase64 = null;

    try {
      if (clearAuthFirst && fs.existsSync(this.sessionPath)) {
        fs.rmSync(this.sessionPath, { recursive: true, force: true });
      }
      fs.mkdirSync(this.sessionPath, { recursive: true });

      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = baileys;

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      let version;
      try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version;
      } catch {
        version = [2, 3000, 1015901307];
      }

      const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: Browsers.macOS("SINKR∞ Max"),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 45000,
        defaultQueryTimeoutMs: 45000
      });

      this.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrRaw = qr;
          this.status = "QR_READY";
          this.lastError = null;
          try {
            this.qrBase64 = await QRCode.toDataURL(qr);
          } catch {
            this.qrBase64 = null;
          }
          console.log("[WhatsAppBot] Código QR generado y listo en /dashboard.html");
        }

        if (connection === "open") {
          this.status = "READY";
          this.qrRaw = null;
          this.qrBase64 = null;
          this.lastError = null;
          const rawId = (sock.user && sock.user.id) || "";
          this.connectedPhone = rawId.split(":")[0].replace(/@.+$/, "") || process.env.WHATSAPP_BOT_NUMBER || null;
          console.log("[WhatsAppBot] WhatsApp conectado y listo:", this.connectedPhone);
        }

        if (connection === "close") {
          const statusCode =
            lastDisconnect &&
            lastDisconnect.error &&
            lastDisconnect.error.output &&
            lastDisconnect.error.output.statusCode;

          const loggedOut = statusCode === DisconnectReason.loggedOut;
          this.connectedPhone = null;

          if (loggedOut) {
            this.status = "DISCONNECTED";
            this.lastError = "Sesión cerrada en WhatsApp. Generando nuevo QR...";
            console.warn("[WhatsAppBot] Sesión cerrada; reiniciando para nuevo QR.");
            this.reconnectTimer = setTimeout(() => {
              this.initialize(true).catch(() => {});
            }, 2500);
          } else {
            this.status = "DISCONNECTED";
            this.lastError = `Reconectando WhatsApp (código ${statusCode || "red"})...`;
            console.warn("[WhatsAppBot]", this.lastError);
            this.reconnectTimer = setTimeout(() => {
              this.initialize(false).catch(() => {});
            }, 4000);
          }
        }
      });

      sock.ev.on("messages.upsert", async (evt) => {
        try {
          if (!this.active || !this.messageHandler) return;
          if (evt.type !== "notify") return;
          const messages = evt.messages || [];

          for (const msg of messages) {
            if (!msg || !msg.message || !msg.key) continue;
            if (msg.key.fromMe) continue;
            const jid = msg.key.remoteJid || "";
            if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;

            const text = extractMessageText(msg.message).trim();
            if (!text) continue;

            const phone = jid.replace(/@.+$/, "");
            const customerName = msg.pushName || "Cliente";

            const replyText = await this.messageHandler({ phone, customerName, text });
            if (replyText && this.sock) {
              await this.sock.sendMessage(jid, { text: replyText });
            }
          }
        } catch (err) {
          console.error("[WhatsAppBot] Error procesando mensaje:", err.message);
        }
      });
    } catch (err) {
      this.status = "ERROR";
      this.lastError = err && err.message ? err.message : String(err);
      console.error("[WhatsAppBot] Error iniciando Baileys:", this.lastError);
    } finally {
      this.initializing = false;
    }
  }

  async requestPairingCode(phoneRaw) {
    const cleanPhone = String(phoneRaw || "").replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      throw new Error("Número inválido. Usa código de país sin +, ej: 584166214410.");
    }
    if (!this.sock || typeof this.sock.requestPairingCode !== "function") {
      throw new Error("WhatsApp aún está inicializando. Espera 3 segundos y vuelve a intentarlo.");
    }
    if (this.status === "READY") {
      throw new Error("WhatsApp ya está vinculado y conectado.");
    }
    const code = await this.sock.requestPairingCode(cleanPhone);
    return { phone: cleanPhone, pairingCode: code };
  }

  async restart() {
    this.closeSocket();
    this.status = "DISCONNECTED";
    this.qrBase64 = null;
    this.qrRaw = null;
    this.initializing = false;
    await this.initialize(true);
    return this.getState();
  }
}

module.exports = new StandaloneWhatsAppBot();
