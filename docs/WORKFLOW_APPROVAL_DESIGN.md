# Step de aprobación humana en Workflows — diseño

Diseño del diferencial P1 acotado "step de aprobación humana" de `docs/CRM_DESIGN_DOCUMENT.md`. A diferencia del portal y de cotizaciones, esto **sí toca el core de Twenty** (el motor de workflows vive en `twenty-server`/`twenty-front`, no en una Application aparte) — no hay forma de agregar un tipo de step nuevo al builder de workflows sin tocar el motor mismo.

## El mecanismo ya existe — se reutiliza, no se inventa

Investigué a fondo el step `FORM` (el más parecido a "pausar y esperar a una persona") y su primo estructural `DELAY`. Conclusión: el motor de workflows ya tiene un contrato genérico de pausa/reanudación que es agnóstico de qué dispara la reanudación:

1. Cualquier acción puede devolver `{ pendingEvent: true }` desde su `execute()`.
2. El executor genérico (`WorkflowExecutorWorkspaceService.processStepExecutionResult`) marca ese step como `StepStatus.PENDING` y **no avanza** a los steps siguientes de esa rama — pero el `WorkflowRun` completo se queda en `RUNNING` indefinidamente (no hay un estado "esperando" a nivel de run, ver `workflow-should-keep-running.util.ts`: un step en `PENDING` alcanza para mantener todo el run vivo).
3. Cuando algo externo decide que ese step terminó (un humano completando un form, un timer de `DELAY`), se marca el `stepInfo` como `SUCCESS` (con el resultado) y se encola un `RunWorkflowJob` con `lastExecutedStepId` — **no se reinicia el run**, se calculan los `nextStepIds` a partir de ese step puntual y se sigue desde ahí. Todo el estado vive persistido en `workflowRun.state` (JSON en la entidad), no en memoria, así que el resume puede pasar en cualquier worker, minutos u horas después.

El nuevo tipo de acción `APPROVAL` reutiliza exactamente este contrato: `execute()` devuelve `{ pendingEvent: true }`, y aprobar/rechazar hace lo mismo que hace `submitFormStep` hoy (marcar `SUCCESS` + encolar el resume) — descripto en detalle en `packages/twenty-server/src/modules/workflow/workflow-runner/workspace-services/workflow-runner.workspace-service.ts::submitFormStep`.

## Qué SÍ hay que diseñar desde cero (no hay precedente)

Verificado que no existe en ningún lado del módulo `workflow`: concepto de "asignado"/"aprobador", notificación activa (in-app o email) cuando un step queda pendiente, ni una vista de "aprobaciones pendientes". Hoy, con `FORM`, la única forma de enterarse es abrir manualmente el registro `WorkflowRun` — el propio editor de Twenty le muestra al usuario un `Callout` de advertencia sobre esto. Para una aprobación esto no alcanza (nadie va a estar mirando la lista de runs por las dudas), así que estas tres cosas son diseño nuevo:

### 1. Autorización: solo el aprobador asignado puede resolver

`submitFormStep` deja que **cualquier** miembro del workspace con permiso `WORKFLOWS` complete el form de cualquier run — no hay chequeo de identidad. Para `APPROVAL` esto es una decisión deliberada y distinta: el resolver debe verificar que quien llama la mutation es el `assignedWorkspaceMemberId` del step (u otro mecanismo de rol/reporte, fuera de alcance del MVP), y rechazar con un error de permisos si no. Es la diferencia central entre "form genérico" y "aprobación" — sin este chequeo no es una aprobación, es un formulario más.

### 2. Notificación: email al aprobador cuando el step queda pendiente

MVP: cuando `ApprovalWorkflowAction.execute()` devuelve `pendingEvent: true`, además dispara un email al `assignedWorkspaceMemberId` (reusando el servicio de email transaccional que ya usa el propio motor para la acción `SEND_EMAIL`) con un link directo al `WorkflowRun`. No hay bandeja de "pendientes de aprobación" en el MVP — queda anotado como mejora futura (podría ser una vista guardada sobre `WorkflowRun`, pero `stepInfos` es JSON no filtrable por GraphQL directamente, necesitaría un campo/objeto dedicado).

### 3. Sin timeout (por ahora)

`FORM` tampoco lo tiene; `DELAY` sí, vía un job demorado de BullMQ. Para el MVP de `APPROVAL` no agrego expiración — si hace falta un "si no responden en 48hs, escalar", se puede lograr combinando `APPROVAL` con un `DELAY` en paralelo en una fase posterior, no en esta primera versión.

## Modelo de datos

**Settings de la acción** (`ApprovalActionSettings`, análogo a `WorkflowFormActionSettings`):

| Campo | Tipo | Notas |
|---|---|---|
| `assignedWorkspaceMemberId` | string | El aprobador, elegido al diseñar el workflow. **No dinámico en el MVP** — no resuelve algo como "el dueño de la oportunidad"; eso es un follow-up documentado, no esta versión. |
| `instructions` | string (opcional) | Texto libre mostrado al aprobador (qué está aprobando y por qué). |

**Output cuando se resuelve** (consumible por steps siguientes, ej. un `IF_ELSE` que branchea en `approved`):

```
{ approved: boolean, comment?: string, decidedByWorkspaceMemberId: string, decidedAt: string }
```

Decisión de diseño: tanto aprobar como rechazar terminan el step en `StepStatus.SUCCESS` (nunca `FAILED`) — la diferencia la lleva el campo `approved` en el resultado. Esto le da al autor del workflow control total vía un `IF_ELSE` después del step de aprobación, en vez de que un rechazo tire abajo todo el run.

## Progreso

| Pieza | Estado |
|---|---|
| `WorkflowActionType.APPROVAL` (enum compartido) | ✅ Agregado a `packages/twenty-shared/src/workflow/types/WorkflowActionType.ts` |
| `workflowApprovalActionSettingsSchema` / `workflowApprovalActionSchema` (zod) | ✅ Archivos reales, agregados a la unión discriminada en `workflow-action-schema.ts` |
| Exportarlos desde `twenty-shared/src/workflow/index.ts` | ⚠️ **No lo edité** — ver nota abajo |
| Acción del backend (`workflow-actions/approval/*`), factory, módulo, resolver/mutations, validación de activación, cálculo de output schema | 📝 Pendiente, ver lista completa abajo |
| Notificación por email | 📝 Pendiente |
| Frontend (editor del step, visor en un run, íconos, categoría "Human Input") | 📝 Pendiente |

### Por qué no toqué `twenty-shared/src/workflow/index.ts`

Ese archivo lleva el header `Auto-generated file — Any edits to this will be overridden`. Lo genera `packages/twenty-shared/scripts/generateBarrels.ts` vía el target Nx `generateBarrels` (`packages/twenty-shared/project.json`). Es exactamente el mismo tipo de situación que la migración del portal: escribirlo a mano quedaría pisado por la próxima corrida del generador, o divergiría de lo que el generador produciría. **Paso pendiente real**: correr

```bash
npx nx run twenty-shared:generateBarrels
```

en una máquina con el toolchain completo — eso va a agregar automáticamente las líneas de export de `workflowApprovalActionSchema`/`workflowApprovalActionSettingsSchema` al `index.ts`, siguiendo el mismo patrón que ya tienen `workflowFormActionSchema`/`workflowFormActionSettingsSchema` ahí.

## Lista completa de archivos pendientes (relevada comparando FORM y DELAY)

**Backend, ejecución** (`packages/twenty-server/src/modules/workflow/workflow-executor/workflow-actions/approval/`):
- `approval.workflow-action.ts` — implementa `WorkflowAction.execute()`, devuelve `{ pendingEvent: true }` y dispara el email de notificación.
- `approval-action.module.ts`.
- `guards/is-workflow-approval-action.guard.ts`.
- `types/workflow-approval-action-settings.type.ts`.
- Registrar `ApprovalActionModule` en `workflow-executor/workflow-executor.module.ts` (mismo lugar donde está registrado `FormActionModule`).
- Agregar el `case WorkflowActionType.APPROVAL` en el `switch` de `workflow-executor/factories/workflow-action.factory.ts`.
- `workflow-builder/workflow-schema/workflow-schema.workspace-service.ts` — nuevo caso para calcular el output schema (variables `approved`/`comment`/`decidedByWorkspaceMemberId`/`decidedAt` disponibles para steps siguientes), análogo a `computeFormActionOutputSchema`.
- `workflow-builder/workflow-version-step/workflow-version-step-operations.workspace-service.ts` — caso por defecto al crear un step de este tipo.
- `workflow-trigger/utils/assert-version-can-be-activated.util.ts` (+ un nuevo `assert-approval-step-is-valid.util.ts`) — validar que `assignedWorkspaceMemberId` sea un miembro real del workspace antes de poder activar la versión.

**Backend, resolución** (mutation nueva, análoga a `submitFormStep`):
- DTO `resolve-approval-step.input.ts` en `engine/core-modules/workflow/dtos/`.
- Mutation `resolveApprovalStep` en `engine/core-modules/workflow/resolvers/workflow-version-step.resolver.ts` — **con el chequeo de autorización** que `submitFormStep` no tiene (punto 1 arriba).
- Método `resolveApprovalStep` en `WorkflowRunnerWorkspaceService`, calcando `submitFormStep`/`resume`.
- Lógica de envío de email al asignar el step (nuevo, sin precedente — usar el mismo servicio de email que ya consume la acción `SEND_EMAIL`).

**Frontend** (`packages/twenty-front/src/modules/workflow/workflow-steps/workflow-actions/approval-action/`):
- Componente de edición del step (elegir aprobador + instrucciones) — análogo a `WorkflowEditActionFormBuilder.tsx`.
- Componente de resolución (botones Aprobar/Rechazar + comentario) — análogo a `WorkflowEditActionFormFiller.tsx`, pero de solo dos acciones en vez de un form arbitrario.
- Mutation GraphQL + hook `useResolveApprovalStep` (análogo a `useSubmitFormStep`).
- Casos nuevos en los switches de `WorkflowStepDetail.tsx` (edición) y `WorkflowRunStepNodeDetail.tsx` (visualización en un run).
- Ícono + entrada en la categoría "Human Input" del menú "Add step" (junto a `FORM`, ver `HumanInputActions.ts`).
- Tipo `WorkflowApprovalAction` en `types/Workflow.ts` (frontend), sumado a la unión `WorkflowAction`.

## Próximos pasos

1. Escribir la acción del backend + wiring del factory/módulo (la parte más mecánica, con FORM como calco directo).
2. Escribir la mutation `resolveApprovalStep` con el chequeo de autorización — es la pieza más sensible, revisar con cuidado que un miembro que no es el aprobador asignado no pueda resolver el step.
3. Diseñar el email de notificación (a quién, con qué link, con qué copy).
4. Frontend: editor + visor del step.
5. Correr `npx nx run twenty-shared:generateBarrels` para que el barrel de `twenty-shared` quede consistente.
6. Probar el flujo completo contra un Postgres real: crear un workflow con `APPROVAL`, dispararlo, confirmar que otro miembro (no el asignado) no puede resolverlo, aprobarlo como el asignado, y confirmar que el run sigue al siguiente step con el `approved: true` disponible como variable.
