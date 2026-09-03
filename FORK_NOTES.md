# Fork Notes — jsiguenzatorres/CRM

## Origen

- Fuente: [`twentyhq/twenty`](https://github.com/twentyhq/twenty)
- Commit importado: [`9e4717278c29efa3ba0c147f6acf0d68e99a625`](https://github.com/twentyhq/twenty/commit/9e4717278c29efa3ba0c147f6acf0d68e99a625) (2026-08-23)
- Fecha de importación: 2026-08-24
- Qué se copió: el árbol de trabajo completo de ese commit (28,846 archivos, ~384MB), **sin el historial de git de Twenty**. Este repo arranca con su propio historial a partir de un commit único de "importación". Si en algún momento quieres el historial completo de Twenty (útil para `git blame` sobre código no tocado), puedo rehacerlo como un `git subtree`/remote añadido, pero normalmente no aporta valor una vez que empieces a divergir.

## Licencia — léelo antes de usarlo en producción

El proyecto es mayormente **AGPLv3**, con dos excepciones (ver `LICENSE` completo):

1. **~314 archivos marcados `/* @license Enterprise */`** (SSO, row-level permissions, billing, dominios de email, etc.) — estos requieren una suscripción comercial de Twenty.com para usarse **en producción**. El código está presente (así se distribuye el self-host oficial) pero las features están bloqueadas por una license key; sin key, simplemente no se activan. Si personalizas/activas alguna de estas rutas para producción, necesitas licencia comercial.
2. **Paquetes MIT**: `twenty-sdk`, `twenty-client-sdk`, `create-twenty-app`, `twenty-shared`, `twenty-ui`, y las apps en `twenty-apps/` — estos sí puedes usarlos/modificarlos libremente.

El resto (AGPLv3) permite auto-hospedar y modificar libremente, **pero** si corres una versión modificada como servicio de red accesible a otros, la sección 13 de AGPLv3 te obliga a ofrecer el código fuente correspondiente a esos usuarios. Hay una "Twenty Application Exception" que permite construir *aplicaciones* sobre las Application Interfaces (REST/GraphQL/webhooks/SDK) sin heredar AGPLv3 — pero modificar el core de Twenty sí queda bajo AGPLv3 completo.

**Recomendación práctica**: si esto es para uso interno/personal, estás cubierto. Si planeas ofrecerlo como servicio a terceros con modificaciones al core, añade un enlace "Código fuente" visible en la UI que apunte a este repo (o a un mirror público), y evalúa si necesitas las features Enterprise bajo licencia comercial.

## Qué NO se hizo todavía

- **No se corrió `yarn install` ni build**: este sandbox tiene Node 22.22, pero Twenty requiere `^24.5.0` (ver `.nvmrc`) y Yarn 4. Tampoco hay Postgres/Redis disponibles aquí. Instálalo en tu propia máquina o CI:
  ```bash
  nvm install 24 && nvm use 24
  corepack enable
  yarn install
  bash packages/twenty-utils/setup-dev-env.sh   # Postgres/Redis + init DB
  yarn start                                     # front + server + worker
  ```
  O usa Docker: `packages/twenty-docker/` trae `docker-compose.yml` para self-hosting sin tocar Node local.
- **GitHub Actions**: se copiaron los 46 workflows de `.github/workflows/` tal cual. Varios son de despliegue/publicación específicos de la infraestructura de Twenty.com (`cd-deploy-main.yaml`, `cd-deploy-tag.yaml`, `ci-dpa-subprocessors-sync.yaml`, `ci-ai-catalog-sync.yaml`, etc.) y **fallarán o no tienen sentido** en este repo por falta de secrets/permisos. No los deshabilité porque prefiero que decidas cuáles quieres conservar (lint/test) vs. borrar (deploy/sync) — puedo hacerlo si me confirmas.

## Arquitectura (resumen para tu revisión)

> Mapa de directorios más detallado (qué hay dentro de `engine/`, `modules/`, `core-modules/` en el server y de `modules/` en el front) en [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

Monorepo Nx + Yarn workspaces, ~20 paquetes. Los relevantes para el producto CRM:

| Paquete | Rol |
|---|---|
| `twenty-server` | Backend: NestJS + TypeORM + PostgreSQL + Redis + GraphQL (schema dinámico por workspace/metadata) |
| `twenty-front` | Frontend: React 18 + Jotai (estado) + Linaria (CSS-in-JS zero-runtime) + Vite |
| `twenty-shared` | Tipos/utilidades isomórficas compartidas front/back (MIT) |
| `twenty-ui` | Librería de componentes (MIT) |
| `twenty-sdk` / `twenty-client-sdk` / `create-twenty-app` | Toolkit para construir "Applications" sobre Twenty (MIT) |
| `twenty-emails` | Plantillas de email transaccional |
| `twenty-docker` | Imágenes/compose/Helm para self-hosting |
| `twenty-website`, `twenty-docs` | Sitio de marketing y documentación pública — probablemente **no los necesitas** para tu CRM interno; son candidatos a eliminar si quieres reducir el repo |
| `twenty-zapier`, `twenty-cli`, `twenty-codex-plugin`, `twenty-claude-skills` | Integraciones/tooling auxiliar — también candidatos a podar según lo que uses |

**Puntos fuertes del diseño** (útiles como referencia al mejorar tu CRM):
- **Metadata-driven data model**: los objetos CRM (Company, Person, Opportunity, etc.) no son tablas fijas — `twenty-server/src/engine` genera el esquema (Postgres + GraphQL) dinámicamente por workspace a partir de metadata, permitiendo campos/objetos custom sin migraciones manuales por cliente.
- **Multi-tenant por workspace** con su propio schema Postgres aislado.
- **Módulos de negocio ya resueltos**: `company`, `person`, `opportunity`, `workflow` (automatizaciones), `messaging`/`calendar` (sync con Gmail/Google Calendar/IMAP), `dashboard`, `timeline` — son el corazón de un CRM y están completos.
- **Workflow automation engine** (`modules/workflow`) con triggers/steps, útil si quieres automatizaciones tipo "cuando cambia stage → enviar email".

## Próximos pasos sugeridos (para la parte de "mejorar")

1. **Decidir alcance**: ¿mantener todo el monorepo (website, docs, zapier, SDK) o podar a solo `twenty-server` + `twenty-front` + `twenty-shared` + `twenty-ui` + `twenty-docker`? Reduce complejidad de mantenimiento si no vas a ofrecer un SDK público.
2. **Rebranding**: logo/nombre en `packages/twenty-website` (si se mantiene) y en el front (`twenty-front/src/config`), variables de entorno `.env` (ver `packages/twenty-server/.env.example` si existe) y `docker-compose.yml`.
3. **Levantar el entorno local** (Node 24 + Docker) y correr `yarn start` para verificar que todo funciona antes de personalizar.
4. **Revisar `.github/workflows`** y podar lo que no aplique a tu infraestructura.
5. Una vez levantado, puedo ayudarte a revisar módulos específicos (p.ej. `workflow`, `messaging`, permisos) o implementar features concretas que quieras agregar/cambiar.

---
*Este archivo lo generó Claude como parte de la importación inicial. No es documentación oficial de Twenty.*
