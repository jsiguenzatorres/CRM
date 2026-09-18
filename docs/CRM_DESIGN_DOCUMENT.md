# Documento de diseño — nuestro CRM

Comparativa de CRMs open source relevantes en GitHub, evaluación de por qué seguimos construyendo sobre Twenty, y el set de funcionalidades diferenciales de cada alternativa que vale la pena incorporar a este fork.

## Metodología

Repos evaluados por relevancia real (estrellas, actividad, foco en CRM) vía búsqueda en GitHub (`topic:crm`, `stars:>1000`) más research de reseñas comparativas 2026. Fecha del corte de datos: 2026-09-16.

## Comparativa

| Proyecto | ⭐ Stars | Licencia | Stack | Enfoque diferencial |
|---|---|---|---|---|
| **Twenty** (nuestra base) | 56.9k | AGPLv3 + módulos Enterprise con license key | TypeScript, React, NestJS, GraphQL, PostgreSQL | Modelo de datos metadata-driven, UI moderna, GraphQL autogenerado por objeto, MCP server para agentes IA |
| **ERPNext** (Frappe) | 39.3k | GPL-3.0 | Python (Frappe framework) | ERP completo: CRM integrado nativamente con contabilidad, inventario, RRHH, manufactura |
| **Krayin** | 23.9k | MIT | Laravel + Vue | CRM ligero enfocado en leads/pipeline, empaquetado para multi-tenant SaaS desde el día uno |
| **SuiteCRM** | 5.75k | AGPL-3.0 | PHP | Automatización de procesos de negocio más madura del mercado (AOW), portal de autoservicio, cotizaciones/contratos |
| **Frappe CRM** (standalone) | 3.5k | AGPL-3.0 | Python + Vue | CRM puro del ecosistema Frappe, kanban de pipeline, buena API |
| **EspoCRM** | 3.36k | AGPL-3.0 | PHP | Todo "de fábrica": email marketing masivo, sync IMAP/SMTP bidireccional, log de llamadas VoIP, report builder sin código |
| **CiviCRM** (core) | 774 | AGPL/GPL mixto | PHP (plugin WP/Drupal/Joomla) | Vertical nicho: donantes, membresías, eventos — no aplica a un CRM de ventas genérico |
| **Monica** (referencia, no competidor) | 25.3k | AGPL-3.0 | PHP/Laravel | CRM *personal*: profundidad de notas de relación (fechas importantes, regalos, historial) |

No se incluyen Salesforce/HubSpot/Pipedrive por no ser código abierto ni auditable en GitHub, aunque se usan como vara de "feature parity" en las reseñas consultadas.

## Por qué seguimos sobre Twenty

Ya lo elegimos como base del fork (ver `FORK_NOTES.md`) y la comparativa lo confirma:

- Es, con diferencia, el más popular y de mayor tracción (56.9k stars vs. 3-24k del resto de CRMs puros).
- Stack moderno (React 18 + NestJS + GraphQL) frente a PHP monolítico de EspoCRM/SuiteCRM/CiviCRM — más fácil de mantener y de que un modelo de lenguaje genere código correcto en él.
- Modelo de datos metadata-driven (objetos/campos custom sin migración manual) es superior al de la mayoría — solo ERPNext ofrece algo comparable, pero acoplado a un ERP completo que no necesitamos.
- Primer CRM open source con posicionamiento "AI-first" real — y tras el mapeo funcional (`docs/FUNCTIONAL_MAP.md` § 4) esto se confirmó con mucho más detalle del esperado: chat multi-agente, agentes personalizables con evals, servidor MCP, meta-tools que dejan que la IA administre workflows/dashboards/campañas completos, y code interpreter con sandbox — todo libre, sin gating Enterprise.
- Las reseñas 2026 usadas en la comparación original decían que a Twenty le faltaba automatización de marketing; el mapeo funcional mostró que eso ya está resuelto en el código (`modules/emailing`). Esas reseñas hablaban de una versión desactualizada o de la oferta cloud, no de este código self-hosted.

**Decisión: no migrar de base.** Seguimos sobre Twenty y le incorporamos los diferenciales de abajo.

## Diferenciales a incorporar

Funcionalidades donde una alternativa gana claramente, mapeadas a dónde irían en la arquitectura actual (`docs/ARCHITECTURE.md`) y priorizadas.

> **Actualizado tras el mapeo funcional completo** (`docs/FUNCTIONAL_MAP.md`, código leído directamente): varios de estos ítems ya estaban resueltos en el código de Twenty y las reseñas externas usadas en la comparación original estaban desactualizadas o hablaban de la oferta cloud, no del código self-hosted. Detalle de cada corrección en `docs/FUNCTIONAL_MAP.md` § 6.

| Prioridad | Diferencial | Origen | Estado real / dónde iría |
|---|---|---|---|
| ~~P0~~ ✅ | ~~Email marketing masivo~~ | EspoCRM | **Ya existe.** `modules/emailing` tiene campañas, listas, plantillas, supresión/unsubscribe y billing por envío completos. |
| **P2** (bajado de P0) | Report builder 100% manual/sin-código (sin depender del chat de IA) | EspoCRM | Ya cubierto parcialmente por `dashboard/chart-data` (agregaciones) + IA conversacional para armar dashboards. Falta el flujo manual puro para quien no quiera usar IA. |
| **P1** (acotado) | Step de **aprobación humana** dentro de un workflow (esperar que una persona apruebe antes de continuar) | SuiteCRM (AOW) | El resto de "automatización robusta" ya existe (`modules/workflow`: condicionales, loops, formularios, HTTP, cron, webhooks, paso de IA) — falta específicamente este step |
| **P1 — en diseño** | Portal de autoservicio para clientes externos (ver/comentar sus propios casos) | SuiteCRM | Gap real confirmado. Diseño completo (modelo de datos, auth por magic link, guard/resolver dedicados sin depender de la RLS Enterprise, frontend separado) en [`docs/CUSTOMER_PORTAL_DESIGN.md`](./CUSTOMER_PORTAL_DESIGN.md) |
| **P1 — en progreso** | Cotizaciones/contratos/proposals con PDF generado y captura de aceptación | SuiteCRM | Gap real confirmado. No es un módulo del core (`modules/quote`) sino una Application separada que extiende el patrón ya probado de `packages/twenty-apps/examples/document-generator`. Diseño y avance real en [`docs/QUOTES_DESIGN.md`](./QUOTES_DESIGN.md) |
| **P2** (acotado) | Click-to-call e integración de proveedores VoIP | EspoCRM | `modules/call-recording` ya modela grabación + transcript + summary ligados a eventos de calendario — falta la integración VoIP en sí |
| **Decisión legal, no técnica** | Empaquetado multi-tenant SaaS "listo para vender" (self-serve signup, billing por tenant) | Krayin | **Ya existe en código** (Stripe, planes, entitlements, créditos) pero la carpeta `billing/` completa está bajo `@license Enterprise` de Twenty.com. Definir: pagar licencia comercial, o construir billing propio no derivado de ese código |
| **P2** | Notas de relación enriquecidas (fechas importantes, contexto personal por contacto) | Monica | Extender `modules/note` / `modules/person` con campos custom vía metadata — no requiere código nuevo, solo definir el objeto |
| **P3 (evaluar, no comprometido)** | Integración nativa con contabilidad/inventario | ERPNext | Fuera de alcance por ahora: implica ser un ERP, no un CRM. Si se necesita, integrar por API con un sistema contable externo en vez de construirlo |

## Fases propuestas

1. **Fase 1 — Gaps P1 confirmados**: portal de autoservicio para clientes y cotizaciones/contratos. Son los únicos diferenciales de la comparación que siguen siendo huecos reales tras el mapeo funcional.
2. **Fase 2 — Acotados**: step de aprobación humana en workflows, integración VoIP sobre `call-recording`.
3. **Fase 3 — Pulido P2**: report builder 100% manual, notas de relación enriquecidas.
4. **Decisión pendiente (no técnica)**: si se necesita empaquetar esto como SaaS multi-tenant facturable, definir si se paga la licencia Enterprise de Twenty.com (el código de billing ya existe) o se construye un billing propio.
5. **Fuera de alcance**: convertirnos en ERP (ERPNext/Odoo) o en plataforma de donaciones/membresías (CiviCRM) — son verticales distintas a las que no apunta este CRM.

## Integración con AsistentesPersonales

Contexto: `AsistentesPersonales` (`C:\Sistemas\AsistentesPersonales`) es la app de asistentes virtuales humanizados que da seguimiento a ventas, capacitaciones, soporte técnico y asistencia tributaria. Cuando un asistente virtual escala un caso a un humano, este CRM debe quedar como el expediente único donde tanto lo atendido por el asistente como por la persona queda documentado y es seguible.

**Decisión: repos y despliegues separados, integrados por API — no fusionar los codebases.**

- Twenty es AGPLv3 con una "Application Exception" pensada exactamente para esto: construir aplicaciones externas contra sus interfaces (REST/GraphQL/webhooks/SDK) sin heredar la licencia. Meter el código de AsistentesPersonales dentro del monorepo y tocar el core sí heredaría AGPLv3.
- Ciclos de despliegue y perfiles de infra distintos (canales en tiempo real y colas de LLM vs. app web de CRM).

### Modelo de datos: objeto `Case`

Un único objeto de metadata (definido vía `twenty-sdk` / `defineObject`, sin tocar el core) representa cada atención, sea resuelta por el asistente virtual o escalada a un humano. No hace falta un objeto separado de "evento": el `Note` y el `Timeline` que Twenty ya genera automáticamente por objeto (`modules/note`, `modules/timeline`) sirven como bitácora de la conversación.

| Campo | Tipo | Notas |
|---|---|---|
| `type` | Select | `sales` \| `training` \| `support` \| `tax` — ampliable |
| `channel` | Select | `whatsapp` \| `web-chat` \| `voice` \| `email`, etc. |
| `status` | Select | `open` → `in_progress` → `escalated` → `resolved` → `closed` |
| `externalConversationId` | Texto (único) | ID de la conversación en AsistentesPersonales — clave de idempotencia para no duplicar el `Case` en reintentos |
| `handledByAssistant` | Texto | Qué asistente virtual lo atendió inicialmente |
| `assignee` | Relación a `WorkspaceMember` | Se completa al escalar a un humano |
| `escalationReason` | Texto | Por qué el asistente no pudo resolverlo solo |
| `person` / `company` | Relación a objetos existentes | Buscar-o-crear por teléfono/email al recibir el primer mensaje del contacto |

### Contrato de API

1. **Autenticación**: API key de workspace (`engine/core-modules/api-key`) guardada solo en el backend de AsistentesPersonales — nunca en un cliente/canal expuesto.
2. **Alta/actualización de caso**: AsistentesPersonales llama a las mutations GraphQL que Twenty autogenera para `Case` (`createCase`/`updateCase`) — no hay que escribir endpoints a mano en el CRM, es el mismo mecanismo metadata-driven de cualquier objeto custom.
3. **Bitácora**: cada turno relevante de la conversación se documenta creando un `Note` enlazado al `Case`, en vez de mandar el transcript completo como un solo campo — así queda navegable en la UI del CRM igual que el resto de las notas.
4. **Escalamiento**: AsistentesPersonales actualiza `status: escalated` y deja `assignee` sin asignar (a la cola). Un `Workflow` (motor ya existente en `modules/workflow`, ver diferencial P1 de automatización avanzada) dispara la notificación al equipo humano — no hace falta lógica de notificación nueva del lado de AsistentesPersonales.
5. **Vuelta del humano al asistente**: se registra un webhook saliente de Twenty sobre el objeto `Case` (nota nueva o cambio de `status` a `resolved`) apuntando a un endpoint de AsistentesPersonales, para que el canal original (WhatsApp/web/voz) reciba la respuesta del humano o el cierre del caso.

### Canal WhatsApp: lo maneja AsistentesPersonales, no el CRM

Verificado en el código: Twenty **no tiene integración de WhatsApp**. En `twenty-front/src/pages/settings/communications/SettingsWorkspaceCommunications.tsx` el tab "Whatsapp" existe solo como placeholder (`disabled: true, pill: 'Soon'`) — sin driver, sin entidad de canal, sin tool de IA que lo use (las únicas tools de comunicación hoy son `email-tool` y `calendar-tool`, ver `docs/FUNCTIONAL_MAP.md` § 4). Construirlo dentro de `modules/messaging` implicaría replicar el patrón completo de driver que ya tiene Gmail/Microsoft/IMAP (import, envío, sync de estado, matching de participantes) — mucho trabajo para una capacidad que AsistentesPersonales, al ser la app pensada para conversar con clientes, muy probablemente ya necesita construir para sí misma de todos modos.

**Decisión: el canal WhatsApp (escribir, llamar, contestar) lo implementa y posee AsistentesPersonales**, vía la API de WhatsApp Business/Twilio/proveedor equivalente — no se construye un driver de WhatsApp dentro de este CRM. La integración con Twenty se limita a lo ya definido arriba: cada interacción por WhatsApp se documenta como un `Case` con `channel: whatsapp`, y el `externalConversationId` guarda el identificador de esa conversación de WhatsApp para poder correlacionarla del lado de AsistentesPersonales. Si en el futuro se necesitara ver el hilo de WhatsApp *dentro* de la ficha del `Case` en el CRM, alcanza con que AsistentesPersonales cree un `Note` por mensaje relevante (como ya se definió en el contrato de API) — no hace falta que Twenty hable con la API de WhatsApp directamente.

### Pendiente de validar

- Si `core-modules/api-key` soporta scoping por objeto (limitar la key solo a `Case`/`Note`) o si hay que tratarla como acceso amplio y compensar con una key dedicada solo para esta integración.
- Formato exacto del payload de los webhooks salientes de Twenty (revisar `engine/core-modules` en el código antes de implementar el receptor en AsistentesPersonales).

## Próximos pasos

- Validar prioridades con necesidades reales de uso (no todas las P0/P1 aplican si el caso de uso no incluye marketing por email, por ejemplo).
- Por cada ítem elegido, abrir una spec corta antes de implementar: qué objeto/entidad de metadata se agrega, qué endpoints GraphQL expone, qué UI en `twenty-front`.
- Revisar si algún diferencial cae bajo una feature ya marcada `/* @license Enterprise */` en el código de Twenty antes de construir sobre ella (ver `FORK_NOTES.md` § Licencia).
