# Ckekea — Sitio Multipágina conectado al Bot Max (+584166214410) y Chatbot-ApiRest

Arquitectura multipágina en **HTML5, CSS3 y JavaScript puro** integrada con los datos reales de `Chatbot-ApiRest` (`BOT_NAME="Max"`, `COMPANY_NAME="Ckekea"`, `WHATSAPP_ENABLED=true`, `WHATSAPP_BOT_NUMBER=+584166214410`, `WHATSAPP_SESSION_PATH=.wwebjs_aut`).

## Páginas conectadas entre sí

- `index.html` — Inicio: Hero estilo Apple, carrusel *Ecosistema Ckekea*, tarjetas de navegación a cada página y controles de seguridad ISO/IEC 27001:2022 + OWASP API Top 10.
- `chatbot.html` — **Max IA & Portal Bot + API**: consola interactiva con el flujo real de Max (`1️⃣ Planes`, `2️⃣ Demo de venta`, `3️⃣ Seguridad y ERP`, `4️⃣ Diagnóstico rápido`) + portal desbloqueable tras pagar con `X-API-Key`, QR WhatsApp, PDF de Cierre Semanal y descarga de `.env.client-bot`.
- `planes.html` — **Planes Estándar, Pro y Gold**: precios USD/Bs con alternador Mensual/Anual, matriz comparativa completa (Ckekea App, API Bancaria anti-fraude, ERP Saint/Profit Plus/A2/Valery/Premium Soft) y pasarela Pago Móvil Mercantil.
- `api-studio.html` — **API Studio**: configuración de `standalone-chatbot-api.ts` (`:3000`) y `client-sales-bot.ts` (`:3001`), carga de OpenAPI JSON, tabla de API Keys generadas y descarga de `config.js`.
- `fundadores.html` — **Equipo Fundador & Contacto**: Fidel Pereira (Fundador), Jesús Romero (CEO) y José Davalillo (Ingeniero y Desarrollador de Software) con pop-ups detallados y contacto WhatsApp a Max (`+58 416-6214410`) y Pagos (`0424-6003606`).

## Archivos compartidos

- `config.js` — Configuración editable a mano (datos de Max, Pago Móvil Mercantil `0105` / `V-31.091.406` / `0424-6003606`, planes, fundadores, seguridad y endpoints).
- `layout.js` — Inyecta la barra de navegación con página activa, footer, dock flotante de Max y todos los modales (incluyendo la pasarela de pago fluida estilo *bottom sheet* móvil) en las 5 páginas.
- `styles.css` — Diseño Apple responsive optimizado para pantallas móviles (`100dvh`, `16px` en inputs para evitar zoom en iOS, safe-area padding y modal deslizable).
- `app.js` — Motor conversacional completo de Max, integración con `standalone-chatbot-api.ts` (mapeando `PlanType` a `LITE | PRO`), `client-sales-bot.ts` y persistencia compartida entre páginas.
- `.nojekyll` — Desactiva Jekyll en GitHub Pages (configurar **Settings → Pages → Branch: `/ (root)`**).
