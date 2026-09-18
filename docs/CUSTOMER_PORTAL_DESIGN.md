# Portal de autoservicio para clientes — diseño

Diseño del diferencial P1 "portal de autoservicio" listado en `docs/CRM_DESIGN_DOCUMENT.md`. Basado en patrones reales del código (`auth/token/`, `engine/core-modules/api-key/`), verificados por lectura directa.

**Limitación de este entorno, para ser honesto sobre el alcance de esta sesión**: el sandbox donde corro tiene Node 22.22 (el repo pide 24.16 en `.nvmrc`) y no tiene Postgres/Redis corriendo — no puedo compilar, tipar, generar la migración de TypeORM ni correr nada de este código. Por eso lo que sigue es un mix: piezas que **ya son archivos reales en el repo** (entidad, enum de JWT, tipos de payload — no requieren generación de código ni el toolchain completo para escribirse a mano) y piezas que quedan como **bocetos de referencia** (guard, resolver, frontend) porque wirearlas mal sin poder compilar sería peor que no tocarlas. La sección final tiene el plan paso a paso para lo que falta.

### Progreso

| Pieza | Estado |
|---|---|
| `PortalAccessEntity` | ✅ Archivo real: `packages/twenty-server/src/engine/core-modules/customer-portal/portal-access.entity.ts` |
| `JwtTokenTypeEnum.PORTAL_LOGIN` / `PORTAL_ACCESS` | ✅ Agregados al enum real: `auth/types/jwt-token-type.enum.ts` |
| `PortalLoginJwtPayload` / `PortalAccessJwtPayload` | ✅ Archivos reales: `customer-portal/types/*.type.ts` |
| Migración de la tabla `portalAccess` | ⚠️ Sigue pendiente — **no la escribí a mano**, ver la corrección importante más abajo sobre por qué |
| `PortalAuthService`, `PortalAuthGuard`, `PortalCaseResolver` | 📝 Bocetos (sin cambios) |
| Frontend del portal | 📝 Boceto (sin cambios) |

## Alcance del MVP

Un cliente externo (una `Person` ya existente en el CRM) se loguea a un portal separado, ve sus propios `Case` (el objeto que ya diseñamos para la integración con AsistentesPersonales) y puede agregar comentarios. Sin `Opportunity` todavía — se evalúa en una fase 2 si hace falta.

## Decisión clave: no usar el motor de Roles/RLS nativo de Twenty

Twenty ya tiene permisos con "row-level security por reglas de filtro" (`engine/twenty-orm/utils/resolve-row-level-permission-record-filter.util.ts`), pero **ese archivo lleva `/* @license Enterprise */`** y está atado a `BillingEntitlementKey.RLS` — un entitlement de plan pago. Construir el portal sobre ese motor ataría esta feature a la licencia comercial de Twenty.com. En cambio, el aislamiento de datos del portal se construye a mano, con un guard y un resolver dedicados y deliberadamente chicos, fuera del sistema de Roles — más fácil de auditar y sin esa dependencia.

## Identidad: quién es un "usuario de portal"

Se reutiliza `Person` como identidad — no se crea un objeto "Cliente" nuevo. Se agrega una entidad nueva a nivel `core` (no es un objeto de metadata por workspace como `Case`; es infraestructura de auth, igual que `ApiKeyEntity`/`AppTokenEntity` en `engine/core-modules/`): `PortalAccessEntity`.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid (pk) | |
| `workspaceId` | uuid | a qué workspace pertenece este acceso |
| `personId` | uuid | qué `Person` (workspace-entity, vive en el schema del workspace) es este acceso |
| `email` | text | email verificado, el que se usa para pedir el magic link |
| `isActive` | boolean | un admin desactiva el acceso sin borrar el `Person` |
| `createdAt` / `lastLoginAt` | timestamp | |

## Flujo de autenticación: magic link, sin password

Mismo patrón que ya usa Twenty para su propio login normal (`auth/token/services/login-token.service.ts`): un JWT firmado de vida corta, nunca un password que administrar.

1. El cliente pide acceso con su email en `/portal/login`.
2. Si hay un `PortalAccessEntity` activo con ese email, se genera un JWT `PORTAL_LOGIN` (nuevo valor en `JwtTokenTypeEnum`) con `{ portalAccessId, personId, workspaceId }`, vida corta (15 min), enviado por email (reusa el envío transaccional de `engine/core-modules/email/`).
3. Al hacer click, el backend valida ese JWT y emite un JWT `PORTAL_ACCESS` de sesión (vida más larga, ej. 7 días; sin refresh token en el MVP).
4. Ese token va en el `Authorization` de un endpoint separado del que usan los `WorkspaceMember`.

**Boceto de referencia** (siguiendo el patrón exacto de `LoginTokenService`, sin compilar):

```ts
// engine/core-modules/customer-portal/services/portal-auth.service.ts — BOCETO, no compilado
@Injectable()
export class PortalAuthService {
  constructor(
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly twentyConfigService: TwentyConfigService,
  ) {}

  async generatePortalLoginToken(portalAccess: PortalAccessEntity): Promise<AuthToken> {
    const jwtPayload: PortalLoginJwtPayload = {
      type: JwtTokenTypeEnum.PORTAL_LOGIN,
      portalAccessId: portalAccess.id,
      personId: portalAccess.personId,
      workspaceId: portalAccess.workspaceId,
    };
    const expiresIn = '15m';
    return {
      token: await this.jwtWrapperService.signAsyncOrThrow(jwtPayload, { expiresIn }),
      expiresAt: addMilliseconds(Date.now(), ms(expiresIn)),
    };
  }

  async exchangeForSessionToken(portalLoginToken: string): Promise<AuthToken> {
    // valida type === PORTAL_LOGIN (igual que verifyLoginToken), y emite un PORTAL_ACCESS de sesión más largo
  }
}
```

## Guard y resolver dedicados (superficie de ataque chica a propósito)

`PortalAuthGuard` — **no** extiende `WorkspaceAuthGuard` (ese asume un `WorkspaceMember`). Valida el JWT `PORTAL_ACCESS` y agrega al request `{ portalAccessId, personId, workspaceId }`.

`PortalCaseResolver` — separado del resolver genérico metadata-driven que usa el resto del CRM. Expone **una sola query y una sola mutation**:

```ts
// engine/core-modules/customer-portal/portal-case.resolver.ts — BOCETO, no compilado
@UseGuards(PortalAuthGuard)
@Resolver()
export class PortalCaseResolver {
  @Query(() => [PortalCaseDto])
  async myCases(@PortalContext() ctx: { personId: string; workspaceId: string }) {
    // SELECT ... WHERE workspaceId = ctx.workspaceId AND person.id = ctx.personId
    // nunca recibe personId/workspaceId del cliente — siempre del token
  }

  @Mutation(() => PortalNoteDto)
  async addCaseComment(
    @Args('caseId') caseId: string,
    @Args('body') body: string,
    @PortalContext() ctx: { personId: string; workspaceId: string },
  ) {
    // 1. verificar server-side que el Case(caseId).person.id === ctx.personId
    // 2. si no, 403 — este chequeo es LA barrera de seguridad real del portal
    // 3. si sí, crear un Note enlazado al Case (mismo mecanismo que ya usa AsistentesPersonales)
  }
}
```

Que la superficie completa sean estas dos operaciones es intencional: se puede auditar entera de un vistazo, a diferencia de exponer el resolver genérico de objetos con un filtro de permisos por encima (que es justo el patrón Enterprise que estamos evitando).

## Frontend: superficie nueva y mínima, no reutiliza `object-record`

El motor de tablas/vistas de `twenty-front` (`object-record`, `views`, `command-menu`, etc.) asume un `WorkspaceMember` de staff autenticado con permisos internos — no es seguro ni tiene sentido reutilizarlo para un cliente externo. En cambio: una superficie nueva y chica, `twenty-front/src/modules/customer-portal/` + `pages/customer-portal/`, con tres pantallas nada más:
1. **Login** — pedir el magic link por email.
2. **Lista de casos propios** — solo lo que devuelve `myCases`.
3. **Detalle de un caso** — estado + hilo de comentarios, con un textarea que llama `addCaseComment`.

Sin sidebar, sin command menu, sin acceso a ninguna otra parte del CRM — es una app separada que comparte solo el design system (`twenty-ui`).

## Seguridad

- Rate-limit del pedido de magic link por email, reusando `engine/core-modules/throttler/`.
- El JWT de sesión del portal nunca lleva permisos de escritura fuera de `addCaseComment` — no hay forma de que un token de portal llame al resolver genérico de objetos.
- Aislamiento por workspace: el JWT lleva `workspaceId` y el guard lo valida contra la conexión de datos del workspace correcto, igual que hace `WorkspaceAuthGuard` hoy para usuarios internos.
- Un admin desactiva `PortalAccessEntity.isActive` para cortar el acceso sin tocar el `Person` ni sus datos.

## Corrección importante: cómo se migra de verdad la tabla `portalAccess`

El plan original asumía que crear una tabla nueva en el schema `core` era una migración TypeORM común. Es falso, y vale la pena dejarlo explícito porque no es obvio: **el sistema de migraciones TypeORM del schema `core` está congelado**. La propia config lo dice (`database/typeorm/core/core.datasource.ts`):

> "The TypeORM migration system is frozen — historical migrations live in `legacy-typeorm-migrations-do-not-add/` [...]. Do NOT add new files there: write a fast/slow instance command instead."

En su lugar, Twenty reemplazó las migraciones por **"instance commands"** versionados (`packages/twenty-server/docs/UPGRADE_COMMANDS.md`): archivos con timestamp bajo `database/commands/upgrade-version-command/<versión-actual>/`, registrados con el decorador `@RegisteredInstanceCommand('<versión>', <timestamp>)`, que implementan `up`/`down` con SQL crudo vía `QueryRunner`. Se generan así:

```bash
npx nx run twenty-server:database:migrate:generate --name add_portal_access_table --type fast
```

Ese comando (no lo pude correr acá, necesita el toolchain completo) crea el archivo en la carpeta de la versión actual (`TWENTY_CURRENT_VERSION`, hoy `2.35.0` → carpeta `2-35/`, que todavía no existe) **y lo auto-registra** en `instance-commands.constant.ts` — ese archivo de registro no se edita a mano.

**Por qué no lo escribí a mano yo mismo**: hacerlo sin correr el generador dejaría el archivo sin registrar (el pipeline de upgrade nunca lo ejecutaría) y sin el timestamp/carpeta de versión correctos que la CI valida (ver gotcha de `CLAUDE.md` sobre `upgrade-version-command/`). Es un caso real donde escribir el código "a mano" sería peor que no tocarlo.

**Referencia exacta a seguir** una vez generado el archivo (mirando `2-5/2-5-instance-command-fast-1778550000000-create-signing-key-table.ts`, el caso más parecido — otra tabla nueva de infraestructura de auth en `core`):

```ts
import { type QueryRunner } from 'typeorm';

import { RegisteredInstanceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-instance-command.decorator';
import { type FastInstanceCommand } from 'src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface';

@RegisteredInstanceCommand('2.35.0', /* timestamp real que ponga el generador */)
export class AddPortalAccessTableFastInstanceCommand implements FastInstanceCommand {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "core"."portalAccess" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "personId" uuid NOT NULL,
        "email" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "lastLoginAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_portalAccess_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_portalAccess_workspaceId" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_PORTAL_ACCESS_WORKSPACE_ID_EMAIL_UNIQUE" ON "core"."portalAccess" ("workspaceId", "email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_PORTAL_ACCESS_WORKSPACE_ID_EMAIL_UNIQUE"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "core"."portalAccess"`);
  }
}
```

(El nombre de clase, el índice único y el `FK ... ON DELETE CASCADE` a `workspace` deben terminar coincidiendo exactamente con lo que declara `PortalAccessEntity` — que ya es un archivo real en el repo — para que TypeORM y la tabla real no diverjan.)

## Plan de implementación (para retomar en una máquina con el toolchain completo)

1. ~~`PortalAccessEntity`~~ ✅ ya existe. ~~Agregar `PORTAL_LOGIN`/`PORTAL_ACCESS` a `JwtTokenTypeEnum` + tipos de payload~~ ✅ ya existe.
2. Correr `npx nx run twenty-server:database:migrate:generate --name add_portal_access_table --type fast` y completar `up`/`down` con la referencia de arriba.
3. `PortalAuthService` (pedir/verificar magic link, emitir sesión) — implementar sobre el boceto ya escrito más arriba.
4. `PortalAuthGuard`.
5. `PortalCaseResolver` (`myCases`, `addCaseComment`) — la parte más sensible, revisar con cuidado el chequeo `person.id === ctx.personId`.
6. Frontend: `customer-portal/` (login, lista, detalle) como bundle/ruta separada.
7. Probar el flujo completo end-to-end contra un Postgres real, incluyendo el caso de intentar acceder al caso de otro `Person` (debe fallar con 403).
