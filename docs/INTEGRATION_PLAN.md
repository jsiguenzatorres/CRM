# Plan de integración: CRM + AsistentesPersonales (Supabase, GitHub, VPS)

Plan de trabajo para poner este CRM (fork de Twenty) en producción junto a AsistentesPersonales e integrarlos. El diseño funcional de la integración (objeto `Case`, contrato de API, WhatsApp) está en `docs/CRM_DESIGN_DOCUMENT.md` § Integración con AsistentesPersonales; acá va el *cómo* y en qué orden.

## Estado verificado (2026-09-28)

| Tema | Dato | Fuente |
|---|---|---|
| Repo del CRM | `jsiguenzatorres/CRM`, **público**. Rama por defecto `claude/crm-review-improve-ffjij5`, no existe `main`. La rama de trabajo trae 46 workflows heredados de Twenty | GitHub API, `git ls-remote` |
| Repo de AsistentesPersonales | `jsiguenzatorres/asistentes-personales`, privado. pnpm + turbo: `apps/web` (Next.js 16, puerto 3100) y `apps/ai-service` (FastAPI + Celery sobre Redis, puerto 8000) | Código del repo |
| Despliegue actual de AsistentesPersonales | VPS Hostinger `vps-muestreo`, PM2 detrás de nginx. Subdominios en uso: `asistentes.` (ai-service) y `especialistas.ianovatechsystems.com` (panel); `contabilidad.` es Nexus Finance | `PLAN-DE-TRABAJO-CLAUDE-CODE.md` del repo |
| Supabase de AsistentesPersonales | Proyecto `zskuyooaukfdqvbthygs`, **plan Free**, en una cuenta de Supabase **distinta** a la conectada acá. Usa solo el schema `public` (más `auth` y `storage`), con pgvector y pg_trgm | T-002 del plan de AsistentesPersonales |
| Org de Supabase conectada acá | `jsiguenzatorres`, **plan Pro**, 6 proyectos activos: NexusFinance, AnalisisExpedientes, alma-app, NovaTech, muestreo y "jsiguenzatorres's Project" (entre 12 y 52 MB cada uno). Ninguno contiene las tablas de AsistentesPersonales ni schemas de Twenty | Supabase MCP, consultas de solo lectura |
| Lo que Twenty necesita | Postgres (schema `core` + uno `workspace_*` por workspace), extensiones `uuid-ossp` y `unaccent`, Redis con `noeviction` (cache + colas BullMQ), y dos procesos: `server` y `worker` | `packages/twenty-docker/`, `setup-db.ts` |

## Corrección a la decisión de base de datos

La decisión del 2026-09-28 ("mismo proyecto de Supabase que AsistentesPersonales") suponía que ese proyecto estaba en la org Pro. No es así: está en un proyecto Free de otra cuenta. Eso cambia la cuenta:

- **Free**: 500 MB de base en total y cómputo nano, compartidos con los embeddings `vector(768)` de AsistentesPersonales, que son justamente lo que más crece. Twenty crea decenas de tablas por cada workspace, más las de `core`.
- **Twenty no usa nada propio de Supabase**: ni Auth, ni PostgREST, ni RLS, ni Storage. Solo necesita un Postgres. Y la integración entre las dos apps es por API, no por tablas compartidas. Poner las dos en la misma base no aporta nada funcional; la única razón era el costo.
- **Bloqueante técnico verificado en el código**: Twenty crea las columnas `id` de cada workspace con default `public.uuid_generate_v4()` (`serialize-function-default-value.util.ts`). En Supabase, `uuid-ossp` viene instalada en el schema `extensions` (confirmado en tus proyectos Pro), así que ese `public.uuid_generate_v4()` no existe y la creación del primer workspace falla. Tiene arreglo (ver Anexo), pero es un paso manual más que un Postgres propio no necesita.

| Opción | Costo extra | A favor | En contra |
|---|---|---|---|
| **A. Postgres en contenedor en el VPS** (recomendada) | US$0 | Es la instalación estándar de Twenty (su `docker-compose.yml` ya lo trae). Sin latencia de red por consulta. Sin cupos ni el problema de `uuid-ossp` | Los backups corren por nuestra cuenta. Usa RAM del VPS |
| B. Proyecto en la org Pro | ~US$10/mes por un cómputo Micro nuevo, o US$0 reusando uno existente con espacio | Administrado, backups diarios, 8 GB | Twenty hace muchas consultas por request: si el VPS no está cerca de la región del proyecto, se nota en la UI. Requiere los ajustes del Anexo |
| C. Proyecto Free de AsistentesPersonales | US$0 | Ninguno funcional | 500 MB y cómputo nano compartidos con producción de AsistentesPersonales, otra cuenta, sin backups |

**Decisión (2026-09-28): A**, confirmada por el usuario. Si la Fase 0 muestra que al VPS no le alcanza la RAM, el plan B es un proyecto de la org Pro creado en la región más cercana al VPS. C queda descartada.

Fuera del alcance del CRM pero relevante: AsistentesPersonales corre en producción, con clientes reales, sobre un proyecto Free. Conviene evaluar aparte transferirlo a la org Pro (Supabase permite transferir un proyecto a otra organización si tu usuario es owner de ambas) para tener backups.

## Fase 0: verificaciones y decisiones (tú, ~1 hora)

En el VPS:

```bash
ssh vps-muestreo
nproc; free -h; df -h /
docker --version; docker compose version
sudo ss -ltnp          # puertos ocupados
pm2 ls
redis-cli INFO memory | grep -E "used_memory_human|maxmemory_policy"
```

Criterio: Twenty (server + worker + Postgres + Redis) necesita reservar alrededor de 3 GB de RAM (estimado, se confirma con `docker stats` después del primer arranque) y unos 10 GB de disco para imagen, base y archivos. Si `free -h` muestra menos de eso disponible con todo lo actual corriendo, pasar a la opción B o subir de plan de VPS.

Decisiones:

| # | Decisión | Recomendación |
|---|---|---|
| D1 | Dónde vive la base del CRM | **Decidido: opción A** (Postgres en el VPS) |
| D2 | Dominio | `crm.ianovatechsystems.com`, registro A apuntando a la IP del VPS |
| D3 | Cómo se mapean los tenants de AsistentesPersonales a Twenty | Un workspace para NovaTech ahora. Del lado de AsistentesPersonales, la configuración del CRM se guarda por tenant (nullable), así las otras firmas se suman después sin rediseñar |
| D4 | Dónde guarda Twenty los archivos adjuntos | Volumen local (`STORAGE_TYPE=local`) incluido en el backup. S3 solo si el disco del VPS queda justo |

## Fase 1: GitHub

Autorizada el 2026-09-28. Estado:

| Paso | Estado |
|---|---|
| Traer a la rama de trabajo el commit que solo estaba en la rama por defecto | Hecho |
| Borrar los workflows heredados | Hecho, los 46 |
| `build-image.yaml` | Hecho |
| PR hacia la rama por defecto y merge | Hecho, PR #1 |
| Crear `main` | Hecho, en `d338166c` |
| Marcar `main` como rama por defecto y protegerla | Pendiente del usuario (Settings del repo; no hay herramienta para hacerlo desde acá) |
| Primer build de la imagen | Hecho: run 1 en unos 14 minutos, publicó `ghcr.io/jsiguenzatorres/crm:d338166c723415aa90d480097cfe9274222723c2` y `:main` |
| Visibilidad del paquete en GHCR | Público: las dos etiquetas se descargan sin autenticación |

1. **Podar workflows**: los 46 workflows heredados apuntan a infraestructura de Twenty Inc. (Depot, Nx Cloud, Chromatic, secretos que no existen acá). Borrarlos todos antes de crear `main`, porque varios se disparan con push a `main` y fallarían en cadena.
2. **Workflow propio `build-image.yaml`**: en push a `main` y manual. Construye la etapa final `twenty` de `packages/twenty-docker/twenty/Dockerfile` con contexto en la raíz del repo y publica `ghcr.io/jsiguenzatorres/crm:<sha>` y `:main`. Usa `GITHUB_TOKEN` con `packages: write`, sin secretos extra. Como el repo es público, el runner estándar tiene 16 GB de RAM, suficiente para el build del front (pide 8 GB de heap). La imagen de Twenty upstream (`twentycrm/twenty`) no sirve porque no incluye nuestros cambios.
3. **Crear `main`**: PR de `claude/memanto-context-analysis-vj7ux7` hacia `claude/crm-review-improve-ffjij5`, y desde ahí crear `main`, marcarla como rama por defecto y protegerla (merge solo por PR). Las sesiones de Claude Code siguen trabajando en ramas `claude/*` y entran a `main` por PR.
4. **Más adelante**: un job de deploy por SSH (`VPS_HOST`, `VPS_SSH_KEY` como secretos) que haga `docker compose pull && docker compose up -d`. Al principio el deploy es manual.

El paquete `crm` en GHCR es público, así que el VPS descarga la imagen sin `docker login`. La imagen no lleva secretos: van en el `.env` del VPS. `.github/actions/` queda tal cual: son acciones compuestas que ya nadie usa, sirven de referencia si más adelante se recupera algún job de CI de upstream. `dependabot.yml` también queda: tiene las actualizaciones de versión en 0 y solo deja pasar las de seguridad.

## Fase 2: VPS

1. **Docker**: instalar Docker Engine y el plugin de compose si la Fase 0 mostró que no están. PM2 y AsistentesPersonales no se tocan.
2. **Compose del CRM** en `/opt/crm/`: copiar `packages/twenty-docker/docker-compose.yml` y cambiar solo esto:
   - `image:` de `server` y `worker` a `ghcr.io/jsiguenzatorres/crm:${TAG}`, con `TAG` fijado a un sha concreto (no `latest`).
   - `ports:` de `server` a `"127.0.0.1:3020:3000"` (o el puerto libre que muestre `ss`). Publicado solo en localhost: Docker salta las reglas de UFW, así que publicar en `0.0.0.0` lo dejaría expuesto aunque el firewall diga lo contrario.
   - Con la opción B: quitar el servicio `db` y su `depends_on`, y definir `PG_DATABASE_URL` directo.
3. **`.env`** en `/opt/crm/`, fuera del repo:
   ```
   TAG=<sha>
   SERVER_URL=https://crm.ianovatechsystems.com
   PG_DATABASE_PASSWORD=<openssl rand -hex 24>
   ENCRYPTION_KEY=<openssl rand -base64 32>
   STORAGE_TYPE=local
   ```
   `ENCRYPTION_KEY` cifra los secretos guardados por Twenty (incluidas las credenciales de Twilio de la app click-to-call): va al gestor de contraseñas; si se pierde, esos secretos no se recuperan.
4. **Redis propio del CRM**, el contenedor que ya trae el compose, sin puerto publicado. Verificado en `flush-cache.command.ts`: el `cache:flush` que corre en cada arranque borra solo claves con prefijo de sus namespaces, así que compartir el Redis de Celery no borraría datos de AsistentesPersonales. Aun así va separado: BullMQ exige `noeviction` (configuración de todo el servidor Redis) y separar evita que un reinicio o un pico de memoria de una app afecte a la otra. Cuesta unos 50 MB.
5. **nginx + TLS**: server block para `crm.ianovatechsystems.com` con `proxy_pass http://127.0.0.1:3020`, headers `Upgrade`/`Connection` para websockets, `client_max_body_size 100m`, y `certbot --nginx -d crm.ianovatechsystems.com`, igual que los subdominios existentes.
6. **Primer arranque**: `docker compose up -d`. El entrypoint de la imagen inicializa la base, corre `upgrade` y registra los crons solo. Crear el primer usuario y el workspace de NovaTech desde la UI.
7. **Backups** (opción A): cron diario con `docker compose exec -T db pg_dump -U postgres -Fc default` más un tar del volumen `server-local-data`, rotando 7 copias y subiéndolas fuera del VPS (por ejemplo a un bucket de Supabase Storage de la org Pro, que es compatible con S3). Probar una restauración una vez; un backup no probado no cuenta.
8. **Actualizaciones**: cambiar `TAG` en `.env`, `docker compose pull && docker compose up -d`. El `upgrade` corre solo al arrancar.

## Fase 3: diferenciales del fork en producción

- **Portal de autoservicio y paso de aprobación en workflows**: son cambios en el server y el front, viajan dentro de la imagen a medida que se terminan (estado en sus docs de diseño).
- **Apps `quotes` y `click-to-call`**: completar el boilerplate pendiente y publicarlas contra la instancia con el CLI de `twenty-sdk` (`app:publish` / `app:install`).
- **Twilio (click-to-call Fase 2)**: recién con el CRM público se puede crear la TwiML App apuntando a la ruta `/voip/voice` de la app. Pasos en `docs/CLICK_TO_CALL_DESIGN.md`.

## Fase 4: integración AsistentesPersonales -> CRM (T-602)

El código de esta fase vive en el repo de AsistentesPersonales y se hace desde su sesión de Claude Code, usando este documento y el de diseño como contrato.

**Lado CRM** (este repo):
1. Definir el objeto `Case` como app (`defineObject`, campos en el documento de diseño) y publicarla.
2. Crear una API key dedicada "AsistentesPersonales" en Settings, sección API keys.
3. Registrar un webhook saliente hacia AsistentesPersonales para cambios de `Case`. Antes, revisar el formato del payload y si viene firmado (pendiente en el documento de diseño).

**Lado AsistentesPersonales**:
1. Migración en su Supabase: tabla `crm_outbox` (`tenant_id`, `event_type`, `payload jsonb`, `status`, `attempts`, `last_error`, `created_at`, `sent_at`) con RLS activa y sin políticas (solo service role), más `clients.crm_person_id` y `handoffs.crm_case_id`.
2. Escribir en el outbox en el mismo punto donde hoy ocurre cada evento. Una task de Celery lo vacía contra la API de Twenty con reintentos. Si el CRM está caído, AsistentesPersonales sigue funcionando y los eventos quedan en cola.
3. Mapeo de eventos:

   | Evento en AsistentesPersonales | En el CRM |
   |---|---|
   | Cliente nuevo o identificado (`clients`, `client_identidades`) | Buscar `Person` por email o teléfono, crearlo si no existe, guardar `crm_person_id` |
   | Escalamiento (`handoffs`) | `Case` con `status: escalated`, `escalationReason`, `handledByAssistant`. Idempotente por `externalConversationId` |
   | Mensajes relevantes de la conversación | `Note` ligada al `Case` |
   | Cita agendada (`citas`) | `Note` en el `Person` en v1; `Task` con fecha si hace falta seguimiento |
   | Sesión de capacitación completada | `Note` en el `Person` |

4. Vuelta del humano: endpoint `POST /webhooks/crm` en ai-service (mismo patrón que `/webhooks/recall`) que, cuando un `Case` pasa a `resolved` o recibe una nota del humano, avisa al cliente por el canal original.
5. Configuración: `CRM_API_URL` y `CRM_API_KEY` como variables de entorno para NovaTech en v1. Si en D3 se decide sumar otras firmas, pasa a configuración por tenant con la key en Supabase Vault.

WhatsApp todavía no está implementado en AsistentesPersonales (T-112, esperando aprobación de Meta). No bloquea nada: cuando llegue, sus conversaciones entran por el mismo outbox con `channel: whatsapp`.

## Orden y dependencias

```
Fase 0 (tú) ──> Fase 1 (GitHub) ──> Fase 2 (VPS) ──> Fase 3 (apps, Twilio)
                                          │
                                          └──────────> Fase 4 (integración, repo de AsistentesPersonales)
```

Fase 3 y Fase 4 son independientes entre sí; las dos necesitan el CRM corriendo.

## Anexo: si la base termina en Supabase (opción B)

Pasos previos al primer arranque de Twenty, en el SQL Editor del proyecto elegido:

```sql
select e.extname, n.nspname
from pg_extension e join pg_namespace n on n.oid = e.extnamespace
where e.extname in ('uuid-ossp', 'unaccent');

select nspname from pg_namespace where nspname = 'core' or nspname like 'workspace\_%';
```

- **`uuid-ossp` en `extensions`** (lo normal en Supabase): crear un wrapper para que `public.uuid_generate_v4()` exista:
  ```sql
  create or replace function public.uuid_generate_v4() returns uuid
  language sql volatile as $$ select extensions.uuid_generate_v4() $$;
  ```
- **`unaccent`**: `setup-db.ts` llama a `public.unaccent('public.unaccent'::regdictionary, ...)`. Si la extensión ya existe en `extensions`, el `CREATE EXTENSION IF NOT EXISTS` no hace nada y esa llamada falla. Si no existe, crearla explícitamente en `public`: `create extension if not exists unaccent schema public;`.
- La segunda consulta tiene que devolver vacío: no puede haber schemas `core` ni `workspace_*` previos.
- **Conexión**: usar el *session pooler* (IPv4, puerto 5432). La conexión directa es solo IPv6 y el *transaction pooler* (6543) no mantiene la sesión entre consultas, que es lo que Twenty espera de su pool.
- **Pool**: `PG_POOL_MAX_CONNECTIONS=5` en `server` y en `worker` (el default es 10 cada uno) para no agotar las conexiones del cómputo Micro.
- Crear el proyecto en la región más cercana al VPS.
