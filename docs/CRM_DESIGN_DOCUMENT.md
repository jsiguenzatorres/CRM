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
- Primer CRM open source con posicionamiento "AI-first" real (MCP server) — encaja con hacia dónde va el mercado, y con el hecho de que este mismo proyecto se desarrolla con asistencia de IA.
- Reseñas 2026 lo marcan como el mejor pick para "equipos tech-forward" dispuestos a asumir su falta de automatización de marketing — ese hueco es exactamente lo que este documento propone tapar con diferenciales de otros proyectos, no cambiando de base.

**Decisión: no migrar de base.** Seguimos sobre Twenty y le incorporamos los diferenciales de abajo.

## Diferenciales a incorporar

Funcionalidades donde una alternativa gana claramente, mapeadas a dónde irían en la arquitectura actual (`docs/ARCHITECTURE.md`) y priorizadas.

| Prioridad | Diferencial | Origen | Dónde iría |
|---|---|---|---|
| **P0** | Email marketing masivo con listas de segmentación, tracking de aperturas/clics y plantillas | EspoCRM | Nuevo módulo `modules/email-campaign` en `twenty-server`, reusando el `emailing` module existente como base de envío |
| **P0** | Report builder visual sin código (más allá de `dashboard/` actual) | EspoCRM | Extender `engine/metadata-modules` con definición de reportes agregados + UI en `twenty-front/modules/dashboards` |
| **P1** | Motor de automatización multi-paso más robusto (branching, esperas, aprobaciones) | SuiteCRM (AOW) | Ampliar `modules/workflow` existente — ya tiene triggers/steps, falta profundidad de condicionales y aprobaciones humanas |
| **P1** | Portal de autoservicio para clientes externos (ver/comentar sus propios casos u oportunidades) | SuiteCRM | Nuevo módulo con auth de rol limitado, separado de `workspace-member`, en `engine/core-modules/` |
| **P1** | Cotizaciones/contratos/proposals con PDF generado y firma | SuiteCRM | Nuevo módulo `modules/quote`, reusando `attachment` y `twenty-emails` para envío |
| **P2** | Log de llamadas con integración VoIP (click-to-call, grabación) | EspoCRM | Extender `modules/call-recording` existente (ya soporta grabación) para soportar más proveedores VoIP |
| **P2** | Empaquetado multi-tenant SaaS "listo para vender" (self-serve signup, billing por tenant) | Krayin | Ya existe base multi-tenant por workspace (`engine/workspace-manager`); falta la capa de self-serve signup + billing, hoy gateada como feature Enterprise |
| **P2** | Notas de relación enriquecidas (fechas importantes, contexto personal por contacto) | Monica | Extender `modules/note` / `modules/person` con campos custom vía metadata — no requiere código nuevo, solo definir el objeto |
| **P3 (evaluar, no comprometido)** | Integración nativa con contabilidad/inventario | ERPNext | Fuera de alcance por ahora: implica ser un ERP, no un CRM. Si se necesita, integrar por API con un sistema contable externo en vez de construirlo |

## Fases propuestas

1. **Fase 1 — Cerrar brechas P0**: email marketing y reporting sin código. Son las dos razones más citadas para no elegir Twenty hoy.
2. **Fase 2 — Diferenciales P1**: automatización avanzada, portal de cliente, cotizaciones. Estos acercan a paridad con SuiteCRM en el segmento "enterprise self-hosted".
3. **Fase 3 — Pulido P2**: VoIP, self-serve SaaS, notas de relación enriquecidas.
4. **Fuera de alcance**: convertirnos en ERP (ERPNext/Odoo) o en plataforma de donaciones/membresías (CiviCRM) — son verticales distintas a las que no apunta este CRM.

## Próximos pasos

- Validar prioridades con necesidades reales de uso (no todas las P0/P1 aplican si el caso de uso no incluye marketing por email, por ejemplo).
- Por cada ítem elegido, abrir una spec corta antes de implementar: qué objeto/entidad de metadata se agrega, qué endpoints GraphQL expone, qué UI en `twenty-front`.
- Revisar si algún diferencial cae bajo una feature ya marcada `/* @license Enterprise */` en el código de Twenty antes de construir sobre ella (ver `FORK_NOTES.md` § Licencia).
