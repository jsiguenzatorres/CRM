# Portal de autoservicio para clientes — diseño

Diseño del diferencial P1 "portal de autoservicio" listado en `docs/CRM_DESIGN_DOCUMENT.md`. Basado en patrones reales del código (`auth/token/`, `engine/core-modules/api-key/`), verificados por lectura directa.

**Limitación de este entorno, para ser honesto sobre el alcance de esta sesión**: el sandbox donde corro tiene Node 22.22 (el repo pide 24.16 en `.nvmrc`) y no tiene Postgres/Redis corriendo — no puedo compilar, tipar, generar la migración de TypeORM ni correr nada de este código. Por eso esto queda como **diseño + bocetos de código de referencia** (en bloques de código dentro de este doc, no archivos ya integrados al build), no como una feature terminada. La sección final tiene el plan paso a paso para implementarlo en una máquina con el toolchain completo.

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

## Plan de implementación (para retomar en una máquina con el toolchain completo)

1. `PortalAccessEntity` (entidad `core`, no workspace-entity) + `npx nx run twenty-server:database:migrate:generate --name add_portal_access --type fast`.
2. Agregar `PORTAL_LOGIN` / `PORTAL_ACCESS` a `JwtTokenTypeEnum` + sus tipos de payload en `auth/types/`.
3. `PortalAuthService` (pedir/verificar magic link, emitir sesión) — implementar sobre el boceto de arriba.
4. `PortalAuthGuard`.
5. `PortalCaseResolver` (`myCases`, `addCaseComment`) — la parte más sensible, revisar con cuidado el chequeo `person.id === ctx.personId`.
6. Frontend: `customer-portal/` (login, lista, detalle) como bundle/ruta separada.
7. Probar el flujo completo end-to-end contra un Postgres real, incluyendo el caso de intentar acceder al caso de otro `Person` (debe fallar con 403).
