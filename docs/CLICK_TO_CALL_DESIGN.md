# Click-to-call e integración VoIP — diseño

Diseño del diferencial P2 acotado "click-to-call e integración de proveedores VoIP" de `docs/CRM_DESIGN_DOCUMENT.md`.

## Verificación previa: no existe nada de telefonía en este repo

Antes de diseñar, busqué cualquier rastro de Twilio/Aircall/RingCentral/JustCall/VoIP/dialer en todo el monorepo (`twenty-server`, `twenty-front`, `twenty-apps`): **cero resultados**. Lo único parecido que existe son las apps `packages/twenty-apps/public/call-recorder/` y `packages/twenty-apps/public/fireflies/` — pero son otra cosa: bots que se suman a **videollamadas agendadas** (Zoom/Meet/Teams, vía el `conferenceLink` del evento de calendario) para grabarlas y resumirlas con IA. No marcan un teléfono ni son telefonía — no había ningún ejemplo para "clonar" esta vez, a diferencia de cotizaciones (`document-generator`).

También verifiqué el modelo de datos: **`Company` no tiene campo de teléfono** (`company.workspace-entity.ts`, sin `phone`/`phones`). Solo `Person` lo tiene, vía el composite type `PhonesMetadata` (`primaryPhoneNumber` + `primaryPhoneCallingCode` + `additionalPhones[]`, en `twenty-shared/src/types/composite-types/phones.composite-type.ts`). Por eso esto es "Call" solo sobre `Person`, no sobre `Company`.

## Dos fases, con una decisión de negocio en el medio

### Fase 1 — `tel:` (gratis, sin proveedor, ya implementada)

Un click-to-call mínimo no necesita ningún proveedor de VoIP: el esquema de URI `tel:` delega en lo que el sistema operativo o navegador tenga registrado para llamadas (un softphone instalado, un cliente de escritorio, o el marcador del celular si se abre desde ahí). Es exactamente lo que EspoCRM también ofrece como base antes de cualquier integración paga.

Implementado como una Application más (mismo patrón que cotizaciones): un `command-menu-item` "Call" que aparece al seleccionar un `Person`, que abre un `front-component` que lista sus teléfonos (principal + adicionales) como links `tel:` clicables.

### Fase 2 — Softphone embebido con un proveedor real (requiere decisión, no implementada)

Un click-to-call "de verdad" para un equipo de ventas normalmente espera algo más: marcar sin salir del navegador, grabar la llamada, ver el log automáticamente en el CRM. Eso requiere un proveedor de VoIP real (Twilio Voice, Aircall, JustCall, RingCentral, etc.) con:

- Una cuenta y credenciales de ese proveedor (`applicationVariables`/`serverVariables` de la Application SDK — mismo mecanismo de config que usan otras apps, no lo diseñé en detalle todavía).
- Un SDK de navegador del proveedor embebido en un `front-component` (ej. Twilio Voice JS SDK) para hacer la llamada real desde el browser.
- Un `logic-function` con `httpRouteTriggerSettings` (mismo mecanismo que ya usamos para las rutas públicas de cotizaciones) que actúe de webhook para eventos de la llamada (conectada/finalizada/grabación lista) y los escriba en el CRM — probablemente extendiendo el objeto estándar `call-recording` (hoy pensado para bots de videollamada, pero su modelo de datos — `transcript`, `summary`, `status` — sirve igual para una llamada telefónica) en vez de crear un objeto nuevo.

**Esto no lo diseñé en más detalle ni implementé nada — depende de qué proveedor (si alguno) se quiera pagar y usar, y ese es tu llamado, no algo que yo deba decidir.** Si en algún momento se define un proveedor, retomamos este documento con el diseño concreto contra ese SDK/API puntual.

## Progreso

| Pieza | Estado |
|---|---|
| Verificación de que no hay integración de telefonía previa | ✅ Confirmado por búsqueda exhaustiva |
| App `click-to-call`: `package.json`, `application-config.ts`, `universal-identifiers.ts` | ✅ Archivos reales |
| `front-components/call.front-component.tsx` (lista teléfonos, genera links `tel:`) | ✅ Archivo real |
| `command-menu-items/call-person.command-menu-item.ts` | ✅ Archivo real |
| Rol por defecto, resto del boilerplate (tsconfig/oxlint/yarnrc) | 📝 Pendiente, mismo patrón que en `quotes` |
| Fase 2 (proveedor VoIP real) | ⛔ Sin decisión de negocio tomada — no diseñado |

## Próximos pasos

1. Completar el boilerplate de la app (mismo que en `docs/QUOTES_DESIGN.md` § próximos pasos) y publicarla en un workspace real para probar el click-to-call básico.
2. Decidir si hace falta la Fase 2 y con qué proveedor — recién ahí tiene sentido diseñar credenciales, SDK embebido y webhook de eventos de llamada.
3. Si se confirma un proveedor, evaluar si conviene extender el objeto `call-recording` existente (ligarlo también a llamadas telefónicas, no solo a bots de videollamada) en vez de crear un objeto nuevo.
