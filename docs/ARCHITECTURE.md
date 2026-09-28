# Arquitectura — jsiguenzatorres/CRM

Mapa de directorios para orientarse en el monorepo sin tener que explorarlo a ciegas. Complementa a `FORK_NOTES.md` (contexto del fork, licencia, próximos pasos) y `CLAUDE.md` (convenciones de código). Está escrito a mano a partir del código real del repo, no generado automáticamente.

## Vista general

```
Cliente (navegador)
   │
   ▼
twenty-front  (React 18 + Jotai + Linaria + Vite)
   │  GraphQL (esquema generado por workspace)
   ▼
twenty-server (NestJS)
   ├── engine/          → motor genérico: metadata, ORM dinámico, cache, eventos, API
   ├── modules/         → funcionalidades de negocio del CRM (Company, Workflow, Calendar…)
   └── core-modules/    → servicios transversales (auth, billing, email, feature flags…)
   │
   ▼
PostgreSQL (un schema por workspace) + Redis (cache, colas BullMQ)
```

`twenty-shared` y `twenty-ui` son librerías isomórficas que consumen tanto `twenty-front` como `twenty-server`/otros paquetes (tipos, utilidades, componentes) — mirar ahí antes de reimplementar algo.

## Backend — `packages/twenty-server/src`

| Carpeta | Qué contiene |
|---|---|
| `engine/metadata-modules/` | Definición de objetos/campos/vistas custom por workspace (el corazón del modelo "metadata-driven": un objeto CRM no es una tabla fija, es una fila de metadata que genera tabla + resolvers GraphQL) |
| `engine/twenty-orm/` y `twenty-orm-v2/` | Capa de ORM propia sobre TypeORM que resuelve entidades dinámicas contra el schema Postgres del workspace actual |
| `engine/workspace-manager/`, `workspace-datasource/`, `workspace-cache*/` | Ciclo de vida del workspace: creación de schema, conexión a su datasource, cacheo de su metadata |
| `engine/api/` | Capa GraphQL/REST expuesta a `twenty-front` y a integraciones externas |
| `engine/core-modules/` | Servicios transversales no específicos de un objeto de negocio: `auth`, `billing`, `email`, `feature-flag`, `health`, `i18n`, `cron`, `graphql`, `enterprise` (features con license key), etc. |
| `modules/` | Módulos de dominio del CRM: `company`, `person`, `opportunity`, `workflow` (motor de automatizaciones), `calendar` / `messaging` (sync Gmail/IMAP/Google Calendar), `dashboard`, `timeline`, `task`, `note`, `attachment` |
| `database/` | Migraciones y comandos de actualización de versión (`commands/upgrade-version-command/`, ver gotcha en `CLAUDE.md`) |
| `command/` | Comandos CLI internos (`nx run twenty-server:command …`) |

**Regla mental para ubicar código**: si es genérico para cualquier objeto/workspace → `engine/`. Si es una entidad de negocio del CRM → `modules/`. Si es infraestructura/cuenta/pago que no depende del workspace → `core-modules/`.

## Frontend — `packages/twenty-front/src`

| Carpeta | Qué contiene |
|---|---|
| `modules/` | ~60 módulos por feature (`companies`, `object-record`, `workflow`, `command-menu`, `navigation`, `auth`, `ai`, `dashboards`, `applications`…). Cada módulo suele traer sus propios `states/`, `hooks/`, `components/` |
| `modules/object-record/`, `object-metadata/`, `object-core/` | Núcleo genérico de renderizado: tablas, kanban, campos, formularios que se generan a partir de la metadata del objeto (igual que en backend, no hay una pantalla "Companies" hardcodeada, se genera desde metadata) |
| `pages/` | Páginas top-level (login, settings, records, etc.) que componen los módulos |
| `generated/`, `generated-metadata/`, `generated-admin/` | Tipos y hooks de Apollo generados desde el schema GraphQL (`npx nx run twenty-front:graphql:generate` — no editar a mano) |
| `localization/`, `locales/` | Lingui (strings i18n) |
| `testing/` | Utilidades para tests de componentes |

## Otros paquetes relevantes

| Paquete | Rol |
|---|---|
| `twenty-shared` | Tipos/utilidades isomórficas (MIT) — `guards` como `isDefined` viven acá |
| `twenty-ui` | Librería de componentes (MIT) |
| `twenty-sdk`, `twenty-client-sdk`, `create-twenty-app`, `twenty-apps/` | Toolkit para construir "Applications" externas sobre Twenty vía SDK (MIT) — ver `README.md` para el flujo `defineObject` → `app:publish` |
| `twenty-docker` | Compose/Helm para self-hosting |
| `twenty-e2e-testing` | Playwright |
| `twenty-emails` | Plantillas de email transaccional |
| `twenty-website`, `twenty-docs`, `twenty-zapier`, `twenty-cli`, `twenty-codex-plugin`, `twenty-claude-skills` | Marketing/docs público e integraciones auxiliares — candidatos a podar si no se usan (ver `FORK_NOTES.md`) |

## Multi-tenancy y modelo de datos

- Cada **workspace** tiene su propio schema PostgreSQL aislado. `engine/workspace-manager` lo crea; `engine/workspace-datasource` resuelve la conexión correcta según el workspace de la request.
- Los objetos de negocio (Company, Person, Opportunity, y cualquier objeto custom) no están definidos en migraciones fijas: viven como filas de metadata (`engine/metadata-modules`) que el motor traduce a tablas Postgres reales + tipos/resolvers GraphQL en caliente. Por eso agregar un campo custom no requiere una migración de código.
- El `workflow` (`modules/workflow`) es un motor de automatizaciones con triggers/steps que reacciona a cambios en esos objetos.

## Cómo levantar el entorno

Ver `FORK_NOTES.md` § "Qué NO se hizo todavía" — requiere Node `^24.5.0` (`.nvmrc`), Yarn 4, Postgres/Redis (`packages/twenty-utils/setup-dev-env.sh` o `packages/twenty-docker/`). Comandos de desarrollo del día a día están en `CLAUDE.md`.
