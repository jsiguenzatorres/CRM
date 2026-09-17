# Mapa funcional completo — este fork de Twenty

Inventario de **qué hace** cada parte de la aplicación (no solo dónde vive el código — eso está en `docs/ARCHITECTURE.md`), incluyendo configuración expuesta a administradores, todo el uso real de IA, y las interfaces de usuario. Sirve de base para decidir qué construir y qué no en `docs/CRM_DESIGN_DOCUMENT.md`. Levantado por lectura directa del código (no de la documentación pública de Twenty), fecha de corte: 2026-09-17.

---

## 1. Objetos y módulos de negocio (`twenty-server/src/modules/`)

Objetos estándar simples (sin lógica de servicio propia más allá del motor genérico de objetos):
- **company** — Empresa/Cuenta: nombre, dominio, LinkedIn, ingresos anuales, dirección, dueño de cuenta.
- **person** — Contacto: nombre, emails (principal + adicionales), teléfonos, cargo, empresa. Es el nodo que enlazan mensajería/calendario/matching.
- **opportunity** — Oportunidad de venta: monto, fecha de cierre, etapa, punto de contacto, dueño.
- **attachment** — Adjunto polimórfico (puede colgar de Task, Note, Person, Company, Opportunity, Dashboard o Workflow).
- **task** / **note** — Tarea/Nota con `TaskTarget`/`NoteTarget` que las enlaza a cualquier registro; hooks de limpieza en cascada al borrar/restaurar.

Módulos con lógica propia:
- **blocklist** — lista de exclusión por usuario (email/dominio) para no importar mensajes/eventos de ciertos remitentes; se consume desde `calendar` y `messaging`.
- **call-recording** — grabación de llamadas ligada a eventos de calendario, con `transcript` y `summary` (el generador del summary vive fuera de este módulo, en el motor de IA).
- **match-participant** — resuelve "quién mandó este email/asistió a este evento" contra `Person`/`WorkspaceMember` por email, en lote.
- **workspace-member** — el "usuario CRM": preferencias personales (idioma, zona horaria, formato de fecha/número, tema), cuelgan de él cuentas conectadas, blocklist, tareas asignadas.
- **dashboard** / **dashboard-sync** — un Dashboard es `título + pageLayoutId` (delega el layout a un motor genérico de páginas); `chart-data/` calcula series agregadas (COUNT/SUM/AVG/MIN/MAX, agrupadas) para widgets de gráfico sobre cualquier objeto. **Tiene tools de IA** (`dashboard/tools/`) para que un agente cree dashboards completos (tabs + widgets) por prompt, resolviendo nombres a IDs automáticamente.
- **timeline** — feed de actividad reciente en cada registro; motor genérico dirigido por metadata (no hardcodeado por objeto) que escucha eventos de creación/edición/borrado.
- **calendar** — sincronización con **Google Calendar**, **Microsoft Calendar (Graph)** y **CalDAV** (import y creación saliente), filtrado por blocklist, limpieza de eventos huérfanos al desconectar una cuenta.
- **messaging** — el módulo más grande de mensajería: import/envío vía **Gmail**, **Microsoft Graph**, **IMAP/SMTP genérico**; buzones de grupo entrantes vía **AWS SES+S3** o **Resend**; sincronización de carpetas/labels; monitoreo de canales con sync estancado.
- **messaging-webhooks** — webhooks públicos de **AWS SES** (firma SNS) y **Resend** (firma Svix) para correo entrante/bounces/complaints de campañas.
- **emailing** — **motor completo de campañas de email masivo**: listas de destinatarios, plantillas con variables `{{firstName}}`, envío por lotes, tracking de enviados/fallidos/rebotados/quejas, lista de supresión, tópicos de unsubscribe con página pública de baja, billing por email enviado (costo del proveedor + margen). **Tiene tool de IA** (`save-campaign-tool.ts`) para que un agente cree/edite *borradores* de campaña — nunca envía por sí solo.
- **connected-account** / **connected-account-sync-webhooks** — OAuth2 y refresh tokens para Google/Microsoft, conexión manual IMAP/SMTP/CalDAV (credenciales cifradas), webhooks push (Gmail watch/Pub-Sub, Microsoft Graph) para sync casi en tiempo real.
- **contact-creation-manager** — auto-creación de `Person`/`Company` a partir de emails/eventos recibidos: dedupe, detecta dominios "de trabajo" (excluye gmail.com etc.) antes de crear una Company, parsing heurístico de nombre (no usa IA).
- **onboarding-invite-suggestions** / **onboarding-recent-messages-import** — sugerencias de a quién invitar al workspace según con quién se reunió más el usuario (Google/Microsoft Calendar), e import acelerado de mensajes recientes al conectar una cuenta por primera vez.

### Workflow — el motor de automatización (el módulo con más superficie de IA)

- **Modelo**: `Workflow` (DRAFT/ACTIVE/DEACTIVATED) → `WorkflowVersion` (inmutable, con trigger + steps) → `WorkflowRun` (ejecución concreta con logs por step).
- **Triggers**: evento de base de datos (crear/editar/borrar un registro), manual (botón, global o por registro/bulk), CRON (con schedule), **webhook entrante** (GET/POST, auth opcional por API key).
- **Acciones disponibles**: CRUD genérico (crear/actualizar/borrar/upsert/buscar/elegir registro), enviar/redactar email, crear evento de calendario, ejecutar código (logic function serverless del usuario), llamada HTTP saliente, condicional if/else, iterador (loop), delay, formulario intermedio, y **paso de agente de IA (`AI_AGENT`)**.
- **Meta-herramientas de IA para workflows** (`workflow-tools/tools/`, 17 archivos): un agente de IA puede **crear, versionar, editar steps/edges, activar/desactivar y validar workflows completos por sí mismo**, además de leer/editar el código fuente de las logic functions asociadas.
- Cola de ejecución con throttling configurable por instancia (`WORKFLOW_EXEC_SOFT/HARD_THROTTLE_LIMIT`).
- **No tiene** (gap real): un paso de "aprobación humana" explícito dentro del flujo (esperar que una persona apruebe antes de continuar).

---

## 2. Plataforma y servicios transversales (`twenty-server/src/engine/core-modules/`)

### Auth — métodos soportados
Password (con verificación de email y reset), **Google OAuth**, **Microsoft OAuth**, **SSO empresarial (SAML y OIDC)** — *Enterprise*, magic-link/login-token, **2FA (TOTP)**, impersonation (a nivel workspace y a nivel servidor, con audit log), API Keys, tokens OAuth2 de aplicaciones de terceros, captcha (Google reCAPTCHA o Cloudflare Turnstile, intercambiables), rotación de signing keys JWT — *Enterprise*.

### Billing — todo bajo licencia Enterprise
Integración completa con **Stripe**: planes (PRO/ENTERPRISE), suscripciones, precios por asiento o medidos, **entitlements** (SSO, CUSTOM_DOMAIN, RLS, AUDIT_LOGS — el mecanismo real de gating de esas features), créditos de recursos otorgables/revocables por un admin, y **factura el uso de IA y automatizaciones** (tokens de chat/workflow, ejecución de código, búsqueda web, grabación de llamadas, envío de email) vía Stripe metered billing. Portal de cliente y checkout propios.

### Feature flags — libre (no Enterprise)
Flags por `(key, workspaceId)`. Un subconjunto se marca "público" y aparece en Settings → Lab para que el admin del workspace lo prenda/apague; el resto solo lo puede tocar el admin de servidor desde el Admin Panel.

### Enterprise — el mecanismo de licenciamiento self-hosted
Un `ENTERPRISE_KEY` (JWT) identifica al licenciatario; se revalida periódicamente contra una API externa de Twenty. Sin licencia válida, todas las features marcadas `@license Enterprise` quedan bloqueadas. **Carpetas/áreas completas bajo Enterprise**: `billing/`, `billing-webhook/`, `sso/`, `usage/` (analítica ClickHouse), `cloudflare/` + `dns-manager/` (dominio custom), `emailing-domain/` (buzones de grupo compartidos), `event-logs/` (audit log), rotación de signing keys JWT.

### Resto, agrupado
- **Identidad/sesión**: usuario global, relación usuario↔workspace, sesiones de navegador (listar/revocar), invitaciones, dominios de acceso pre-aprobados, hooks de autoría (`createdBy`/`updatedBy`).
- **Dominios/DNS/multi-tenant**: subdominio propio, resolución de workspace por dominio, dominio custom vía Cloudflare (Enterprise).
- **Config y arranque**: `twenty-config` centraliza *todas* las variables de entorno tipadas por grupo (auth, storage, email, IA, captcha, billing, etc.), con opción de persistir overrides en base de datos editables desde el Admin Panel sin tocar `.env`.
- **Comunicaciones**: email transaccional del propio sistema, verificación de email, DPA (Data Processing Agreement) generado y firmado por workspace con PDF server-side.
- **Infra de datos/cache**: Redis compartido, cache/locks distribuidos, cifrado de secretos (AES-GCM, con rotación de clave por workspace), cliente HTTP con protección SSRF, colas BullMQ.
- **Observabilidad**: métricas de proceso, telemetría anónima opcional, audit log (Enterprise), Sentry, logging estructurado, healthcheck.
- **Archivos/storage**: driver de storage (local/S3), generación de SDK cliente tipado para apps del marketplace.
- **Integraciones externas**: enrichment de empresas/personas vía **People Data Labs** (confirmado: **no usa IA**, es un proveedor de datos B2B tradicional), geocoding.
- **Automatización/extensibilidad de plataforma**: funciones "logic function" definidas por el usuario (drivers local o AWS Lambda), rutas HTTP custom respaldadas por una logic function.
- **API pública**: especificación OpenAPI 3.1 autogenerada de la REST API metadata-driven, hooks transversales de GraphQL (límites de complejidad, introspection deshabilitada sin auth).
- **Upgrade**: orquestación de migraciones de versión a nivel instancia y por workspace.

---

## 3. Interfaz de usuario (`twenty-front/`)

### Núcleo CRM
Grilla estilo spreadsheet con edición inline, kanban, vista calendario, ficha de detalle de registro, filtros (simples y avanzados), agrupar, fusionar duplicados, edición masiva, totales de columna, importación CSV — todo genérico por metadata, no hardcodeado por objeto. Barra de vistas guardadas por objeto. Menú lateral personalizable (agregar carpetas/links/vistas/registros favoritos). Paleta de comandos (Cmd/K) extensible por apps. Editor de texto enriquecido con menciones `@` y slash-menu. Constructor visual de workflows tipo diagrama de nodos.

### Auth / Onboarding
Sign in/up, invitación, reset de password, autorización OAuth de apps de terceros, captcha en signup. Wizard de alta: perfil, plan, conectar email, importar contactos, invitar equipo, instalar apps, agendar llamada, verificación — puede terminar disparando un chat de IA de configuración del workspace.

### Settings — inventario completo

**Sección User**: Profile (foto, 2FA, password, dispositivos con sesión activa), Experience (tema, idioma, zoom UI, formato fecha/hora/número), Accounts (cuentas de email/calendario conectadas).

**Sección Workspace**:
- **General** — logo/nombre, dominio; tab *Security* (SSO, métodos de auth permitidos, rol default, bypass de SSO de emergencia, impersonation, retención de audit logs y de papelera); tab *Logs* (audit log en vivo, Enterprise).
- **Data model** — listar/crear objetos y campos custom, índices, diagrama interactivo del modelo de datos completo.
- **Layout** — modo de edición visual de layouts (arrastrar/redimensionar widgets).
- **Members** — Team, Invite, **Roles** (permisos por objeto CRUD, override a nivel de campo, row-level security por reglas de filtro, permisos sobre secciones de Settings y sobre tools de IA).
- **Billing** (si está habilitado) — plan, Plans, Usage.
- **MCP & APIs** — tab MCP (setup para clientes externos), tab API (playground REST/GraphQL, API keys), tab Webhooks.
- **Apps** — Marketplace, Installed (detalle por app: OAuth, logic functions, componentes UI custom, vistas/layouts que registra), Developer (registrar tu propia app).
- **AI** — ver sección 4.
- **Communication** (detrás de feature flag) — buzones de email compartidos, WhatsApp/Calls ("Soon"), gestión de unsubscribe.

**Sección Other**: Admin Panel (solo super-admins de instancia — salud del sistema, colas, modo mantenimiento, gestión de admins, signing keys, licencia Enterprise, y todo lo de IA a nivel servidor), Community (changelog, features experimentales "Lab"), Support, Documentation, Logout.

**Rutas no listadas en el menú**: Enterprise standalone (activación de licencia), Legal/DPA, Integrations (deshabilitada, "not ready").

---

## 4. Capacidades de IA — inventario consolidado

Confirmado explícitamente: **ninguna funcionalidad de IA está gateada por licencia Enterprise** (grep exhaustivo sin resultados sobre esos archivos). Lo único "de pago" es el sistema de créditos de billing (Enterprise, opcional) que factura el uso — si el self-host corre sin billing, el uso de IA no tiene tope ni costo interno.

| Capacidad | Qué hace | Dónde |
|---|---|---|
| **Chat de IA** ("Ask AI") | Asistente conversacional integrado (página `/ai-chat` + side panel), threads persistentes, streaming, ejecución de código/gráficos, chips clicables a registros/objetos/vistas citados en la respuesta | `engine/metadata-modules/ai/ai-chat/`, `twenty-front/src/modules/ai/` |
| **Agentes personalizables** | Crear "Agentes" con prompt propio, modelo, formato de respuesta (texto o JSON Schema), rol/permisos por objeto, catálogo de tools habilitadas. Definibles también como código vía `twenty-sdk` (`define-agent.ts`) para apps del marketplace | `engine/metadata-modules/ai/ai-agent/`, Settings → AI → Agents |
| **Evals de agentes** | Evaluación tipo LLM-as-judge de las respuestas de un agente | `ai-agent-monitor/`, Settings → Agent → Evals |
| **Paso de IA en Workflows** | Un agente como step más de una automatización, con salida estructurada consumible por steps siguientes | `modules/workflow/workflow-executor/workflow-actions/ai-agent/` |
| **Meta-tools de workflow** | Un agente crea/edita/versiona/activa workflows completos por sí mismo | `modules/workflow/workflow-tools/tools/` (17 archivos) |
| **Motor multi-proveedor de modelos** | Registro de proveedores/modelos, resolución de API keys, costo por token. Nativos: **OpenAI, Anthropic, Google, Mistral, xAI**; soportados vía config custom: Bedrock, Azure, cualquier endpoint compatible con OpenAI (Ollama/LM Studio) | `engine/metadata-modules/ai/ai-models/`, usa el SDK unificado **Vercel AI SDK** |
| **Catálogo de herramientas (tools)** | CRUD de cualquier objeto, metadata, vistas, workflows, roles, dashboards, webhooks, menú de navegación, logic functions, acciones de apps, calendario, email, HTTP arbitrario (con protección SSRF), code interpreter, navegar la UI, búsqueda en el help center, y "skills" cargables bajo demanda | `engine/core-modules/tool-provider/`, `engine/core-modules/tool/` |
| **Code Interpreter** | Ejecuta Python real (pandas/matplotlib) en sandbox **E2B** (cloud, apto para producción) o localmente **sin sandboxing** (bloqueado en `NODE_ENV=production`) | `engine/core-modules/code-interpreter/` |
| **Servidor MCP** | Twenty se expone como servidor MCP (JSON-RPC sobre HTTP/SSE) para que Claude/Cursor/etc. se conecten al workspace y usen las mismas tools. Auth por API key o OAuth 2.1 (RFC 9728) | `engine/api/mcp/`, Settings → MCP & APIs |
| **Tool de campañas de email (IA)** | Un agente crea/edita *borradores* de campaña de email masivo (nunca envía) | `modules/emailing/tools/save-campaign-tool.ts` |
| **Tools de dashboards (IA)** | Un agente crea dashboards completos (tabs, widgets, gráficos) resolviendo nombres a IDs | `modules/dashboard/tools/` |
| **Endpoint REST `generate-text`** | Generación de texto libre con el modelo configurado, para uso interno de apps/logic functions | `engine/metadata-modules/ai/ai-generate-text/` |
| **Admin Panel → AI (nivel servidor)** | El admin de servidor habilita/recomienda modelos, fija el default, agrega proveedores custom, y puede **ver los hilos de chat de IA de cualquier workspace** (soporte/debug) | `engine/core-modules/admin-panel/` |
| **Facturación de uso de IA** | Costo por tokens de entrada/salida/caché/razonamiento por modelo, convertido a créditos si billing está activo; sin billing, solo se registran métricas | `ai-billing/`, `ai-workspace-stats/` |
| **file-ai-chat** | Chat de IA sobre archivos subidos (resolver/servicio dedicado, no se profundizó en el contenido) | `engine/core-modules/file/file-ai-chat/` |

**No usa IA** (verificado, pese a sonar como candidato natural): el enriquecimiento de empresas/personas usa People Data Labs, un proveedor de datos tradicional por API REST.

---

## 5. Configuración — resumen

- **Variables de entorno por grupo** (`ConfigVariablesGroup` en `twenty-config`): auth de Google/Microsoft, captcha, storage, email, billing, Cloudflare, LLM, logic functions, code interpreter, SSL, analytics, duración de tokens, AWS SES/Resend, entre otros. Persistibles en base de datos y editables desde el Admin Panel sin tocar `.env`.
- **Configuración de IA específica**: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `MISTRAL_API_KEY` / `XAI_API_KEY`, `AI_PROVIDERS` (JSON para proveedores custom), `CODE_INTERPRETER_TYPE` + `E2B_API_KEY`, `IS_ONBOARDING_AI_CHAT_ENABLED`, `IS_BILLING_ENABLED` — pero también configurable 100% desde Settings → Admin Panel → AI sin tocar variables de entorno.
- **Configuración de negocio por workspace**: casi todo lo demás (roles/permisos, modelo de datos custom, layouts, dominio, SSO, feature flags "Lab") vive en Settings, editable por el admin del workspace, no del servidor.

---

## 6. Qué corrige esto respecto al documento de comparación

Hallazgos que cambian priorizaciones en `docs/CRM_DESIGN_DOCUMENT.md`:

1. **Email marketing masivo (antes P0) → ya existe.** El módulo `emailing` ya tiene campañas, listas, plantillas con variables, supresión/unsubscribe y billing por envío. La reseña externa que decía "Twenty no tiene email marketing" no aplica a este código.
2. **Report builder sin código (antes P0) → parcialmente cubierto.** No hay un "report builder" tabular dedicado como el de EspoCRM, pero el sistema de dashboards con agregaciones (bar/line/pie/aggregate) más la posibilidad de armarlos por lenguaje natural con IA cubre gran parte del caso de uso. Baja a P2: falta principalmente el flujo 100% manual/sin-código para quien no quiera usar el chat de IA.
3. **Automatización multi-paso robusta (antes P1) → ya es comparable o superior a SuiteCRM.** Ya tiene condicionales, loops, formularios, HTTP, cron, webhooks y un paso de IA. El gap real y específico es un **step de aprobación humana** — se mantiene en P1 pero mucho más acotado.
4. **Empaquetado SaaS self-serve (antes P2, inspirado en Krayin) → ya existe en código, pero 100% bajo licencia Enterprise de Twenty.com.** No es un gap técnico: es una decisión legal/comercial (pagar la licencia, o construir un billing propio no derivado de ese código para no heredar la obligación).
5. **Portal de autoservicio para clientes** y **cotizaciones/contratos** → siguen siendo gaps reales confirmados, ningún módulo existente los cubre.
6. **VoIP/call log** → parcialmente cubierto: `call-recording` ya modela grabación + transcript + summary ligados a un evento de calendario; falta específicamente click-to-call e integración de proveedores VoIP.
7. **El stack de IA es mucho más grande de lo que sugerían las reseñas externas** usadas en la comparación original (chat multi-agente, agentes personalizables con evals, servidor MCP, meta-tools que dejan que la IA administre workflows/dashboards/campañas enteras, code interpreter con sandbox). Esto refuerza aún más la decisión de no migrar de base.
