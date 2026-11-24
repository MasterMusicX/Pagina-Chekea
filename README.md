# Chekea — Web + Pasarela Pago Móvil conectada a `standalone-chatbot-api.ts` y `client-sales-bot.ts`

Sitio web modular en **HTML5, CSS3 y JavaScript puro** conectado directamente a tus dos servicios backend para que, al confirmarse un pago, el cliente obtenga acceso inmediato al **Bot Comercial** y a su **API Key (`sk_live_...`)**.

## Flujo completo conectado

1. El cliente elige **Plan Estándar, Pro o Gold** y selecciona el **rubro del negocio** (`RETAIL`, `PHARMACY`, `TECH`, `HARDWARE`).
2. Realiza el **Pago Móvil** a **Banco Mercantil (`0105`), C.I. `V-31.091.406`, Teléfono `0424-6003606`** y registra su referencia.
3. Al confirmar el pago, la página llama automáticamente a:
   - `POST {baseUrl}/api/v1/chatbot/api-keys/generate` (`standalone-chatbot-api.ts`) enviando `{ name, email, plan, business_type, whatsapp_phone, rotate_secret: false }`.
4. Recibe `tenantId` y `apiKey` (`sk_live_...`) y **desbloquea inmediatamente el Portal Bot + API**:
   - **Acceso API SaaS (`standalone-chatbot-api.ts`)**: Chat real contra `POST /api/v1/chatbot/message` (con `conversation_id`, calificación `POST /api/v1/chatbot/rate/:queryId` y soporte de imágenes Base64), listado de conversaciones (`GET /api/v1/chatbot/conversations`) y descarga de `.env.client-bot`.
   - **Acceso Bot Comercial (`client-sales-bot.ts`)**: Estado en vivo + QR de WhatsApp (`GET /api/state`), chat directo (`POST /api/chat`), encender/apagar bot (`POST /api/toggle`), enlace al Panel QR (`/qr`) y descarga de **PDF de Cierre Semanal** (`GET /api/reports/weekly-pdf` con cabecera `X-Panel-Token`).

## Cómo encender tus backends y conectarlos

1. **En tu proyecto backend:**
   - Inicia la API SaaS del Chatbot: `npm run dev:api` (por defecto en `http://localhost:3000`).
   - Inicia el Bot Comercial: `npm run dev:client-bot` (por defecto en `http://localhost:3001`).
   - En tu `.env`, asegúrate de que `FRONTEND_URL` permita el origen desde donde abres esta página (o déjalo vacío en desarrollo, ya que tus dos archivos usan `origin: true` cuando `FRONTEND_URL` no está definido).
2. **En `config.js` (o en la sección API Studio de la página):**
   - `baseUrl`: URL de `standalone-chatbot-api.ts` (ej. `http://localhost:3000` o tu URL de Railway).
   - `masterApiToken`: tu API Key maestra/admin (`sk_live_...`) para autorizar la creación de nuevos tenants en `POST /api/v1/chatbot/api-keys/generate`.
   - `clientBotBaseUrl`: URL de `client-sales-bot.ts` (ej. `http://localhost:3001` o tu URL de Railway).
   - `clientBotPanelToken`: el valor de `CLIENT_PANEL_TOKEN` si lo configuraste en tu servidor.
   - Si editas los campos en **API Studio**, pulsa **Descargar config.js** y reemplaza el archivo en esta carpeta para dejarlos guardados permanentemente.
