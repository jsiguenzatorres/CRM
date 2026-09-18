# Click-to-call e integración VoIP — diseño

Diseño del diferencial P2 acotado "click-to-call e integración de proveedores VoIP" de `docs/CRM_DESIGN_DOCUMENT.md`.

## Verificación previa: no existe nada de telefonía en este repo

Antes de diseñar, busqué cualquier rastro de Twilio/Aircall/RingCentral/JustCall/VoIP/dialer en todo el monorepo (`twenty-server`, `twenty-front`, `twenty-apps`): **cero resultados**. Lo único parecido que existe son las apps `packages/twenty-apps/public/call-recorder/` y `packages/twenty-apps/public/fireflies/` — pero son otra cosa: bots que se suman a **videollamadas agendadas** (Zoom/Meet/Teams, vía el `conferenceLink` del evento de calendario) para grabarlas y resumirlas con IA. No marcan un teléfono ni son telefonía — no había ningún ejemplo para "clonar" esta vez, a diferencia de cotizaciones (`document-generator`).

También verifiqué el modelo de datos: **`Company` no tiene campo de teléfono** (`company.workspace-entity.ts`, sin `phone`/`phones`). Solo `Person` lo tiene, vía el composite type `PhonesMetadata` (`primaryPhoneNumber` + `primaryPhoneCallingCode` + `additionalPhones[]`, en `twenty-shared/src/types/composite-types/phones.composite-type.ts`). Por eso esto es "Call" solo sobre `Person`, no sobre `Company`.

## Dos fases, con una decisión de negocio en el medio

### Fase 1 — `tel:` (gratis, sin proveedor, ya implementada)

Un click-to-call mínimo no necesita ningún proveedor de VoIP: el esquema de URI `tel:` delega en lo que el sistema operativo o navegador tenga registrado para llamadas (un softphone instalado, un cliente de escritorio, o el marcador del celular si se abre desde ahí). Es exactamente lo que EspoCRM también ofrece como base antes de cualquier integración paga.

Implementado como una Application más (mismo patrón que cotizaciones): un `command-menu-item` "Call" que aparece al seleccionar un `Person`, que abre un `front-component` que lista sus teléfonos (principal + adicionales) como links `tel:` clicables.

### Fase 2 — Softphone embebido con Twilio Voice

Investigué Twilio Voice, Aircall, JustCall y RingCentral (precios, SDK de navegador, qué necesitan de backend). **Se eligió Twilio Voice**: sin costo por asiento (solo número + minutos consumidos), y con un SDK realmente "headless" (`@twilio/voice-sdk`) — no monta ningún iframe con UI ajena, así que el dialer se ve 100% como el resto del CRM. La contrapartida es que todo el trabajo de backend (tokens, TwiML, logging) corre por nuestra cuenta — razonable para un fork propio con `twenty-server` ya en NestJS.

Aircall/JustCall/RingCentral Embeddable habrían sido más rápidos de integrar (SDK con iframe propio) pero a costo fijo por asiento y con una UI de terceros visible dentro del CRM — se descartaron por eso, no por limitación técnica.

#### Server variables (credenciales) — ya declaradas como archivo real

`serverVariables` en `application-config.ts` (mismo mecanismo que ya usa `call-recorder` para su API key de Recall.ai — `isSecret: true` cifra el valor y nunca lo expone al frontend):

| Variable | Secreta | Para qué |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | No | Identifica la cuenta |
| `TWILIO_AUTH_TOKEN` | Sí | Verificar la firma `X-Twilio-Signature` de los webhooks entrantes |
| `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET` | La segunda sí | Emitir los Access Tokens que consume el SDK del navegador |
| `TWILIO_TWIML_APP_SID` | No | La TwiML App cuya Voice URL apunta a `/voip/voice` de esta app |
| `TWILIO_CALLER_ID` | No | Número de Twilio mostrado como caller ID saliente |

Declararlas ya (aunque la lógica que las consume sea boceto todavía) tiene valor real: en cuanto se publique la app, un admin ya ve estos campos para cargar sus credenciales de Twilio.

#### Arquitectura: tres rutas nuevas + un front-component

```
Browser (front-component)                    twenty-server (logic-functions de esta app)         Twilio
─────────────────────────                     ──────────────────────────────────────────         ──────
1. Click "Llamar" ─────────────────────────►  GET /voip/token (isAuthRequired: true)
                                               → jwt.AccessToken con VoiceGrant(TwiML App SID)
   ◄─── { token } ────────────────────────────
2. new Device(token).connect({ params:{To} })
   ───────────────────────────────────────────────────────────────────────────────────────────►  Twilio marca
                                               POST /voip/voice (isAuthRequired: false,             ◄── Twilio pide TwiML
                                               verifica X-Twilio-Signature con TWILIO_AUTH_TOKEN)
                                               → TwiML <Dial callerId="...">{To}</Dial>
                                               ───────────────────────────────────────────────►    conecta la llamada real
                                               POST /voip/status (isAuthRequired: false,             ◄── eventos de la llamada
                                               verifica firma) → loguea en el CRM
```

**Boceto de las tres rutas** (sin escribir a mano — necesitan el paquete `twilio` de npm y no puedo instalar/correr nada acá; ver "Progreso" abajo):

```ts
// logic-functions/mint-voice-access-token.ts — BOCETO
// GET /voip/token, isAuthRequired: true
import twilio from 'twilio';
const handler = async (event: RoutePayload): Promise<Response> => {
  const AccessToken = twilio.jwt.AccessToken;
  const token = new AccessToken(
    process.env[TWILIO_ACCOUNT_SID_ENV_VAR_NAME],
    process.env[TWILIO_API_KEY_SID_ENV_VAR_NAME],
    process.env[TWILIO_API_KEY_SECRET_ENV_VAR_NAME],
    { identity: event.workspaceMemberId }, // requiere confirmar el shape exacto de RoutePayload con isAuthRequired:true
  );
  token.addGrant(new AccessToken.VoiceGrant({
    outgoingApplicationSid: process.env[TWILIO_TWIML_APP_SID_ENV_VAR_NAME],
  }));
  return jsonResponse({ token: token.toJwt() });
};
```

```ts
// logic-functions/voice-twiml.ts — BOCETO
// POST /voip/voice, isAuthRequired: false
import twilio from 'twilio';
const handler = async (event: RoutePayload): Promise<Response> => {
  const isValid = twilio.validateRequest(
    process.env[TWILIO_AUTH_TOKEN_ENV_VAR_NAME],
    event.headers['x-twilio-signature'],
    fullUrl, // reconstruir la URL exacta que Twilio firmó
    event.body, // form-encoded: To, CallSid, etc.
  );
  if (!isValid) return xmlResponse('<Response/>', 403);

  const twiml = new twilio.twiml.VoiceResponse();
  twiml.dial({ callerId: process.env[TWILIO_CALLER_ID_ENV_VAR_NAME] }).number(event.body.To);
  return xmlResponse(twiml.toString());
};
```

```ts
// logic-functions/voice-status-callback.ts — BOCETO
// POST /voip/status, isAuthRequired: false
// Verifica firma igual que arriba. event.body trae CallStatus/CallSid/To/From/CallDuration.
// Busca el Person por To/From vía CoreApiClient y crea un Note con el resumen de la llamada
// (mismo patrón que "crear una Note" que ya usamos en la integración de AsistentesPersonales).
```

**Frontend**: en vez de reemplazar `call.front-component.tsx`, se lo extiende — intenta pedir un token y conectar vía `@twilio/voice-sdk`; si eso falla (Twilio no configurado todavía, o el admin no completó las credenciales) cae directo al comportamiento actual (links `tel:`). Es mejora progresiva, no un reemplazo que rompa la Fase 1.

## Progreso

| Pieza | Estado |
|---|---|
| Verificación de que no hay integración de telefonía previa | ✅ Confirmado por búsqueda exhaustiva |
| Comparación de proveedores VoIP (Twilio/Aircall/JustCall/RingCentral) | ✅ Investigado — Twilio Voice elegido |
| App `click-to-call`: `package.json`, `application-config.ts`, `universal-identifiers.ts` (Fase 1) | ✅ Archivos reales |
| `front-components/call.front-component.tsx` (Fase 1: links `tel:`) | ✅ Archivo real |
| `command-menu-items/call-person.command-menu-item.ts` | ✅ Archivo real |
| `serverVariables` de Twilio en `application-config.ts` (Fase 2) | ✅ Archivo real — declaradas, listas para que un admin cargue credenciales |
| Rol por defecto, resto del boilerplate (tsconfig/oxlint/yarnrc) | 📝 Pendiente, mismo patrón que en `quotes` |
| `mint-voice-access-token.ts` / `voice-twiml.ts` / `voice-status-callback.ts` | 📝 Bocetos — necesitan el paquete `twilio` y no se pudieron compilar/probar acá |
| Dialer embebido en el front-component (`@twilio/voice-sdk`) | 📝 Boceto |

## Próximos pasos

1. Completar el boilerplate de la app (mismo que en `docs/QUOTES_DESIGN.md` § próximos pasos). El propio `CLAUDE.md` de las apps de ejemplo recomienda usar `yarn twenty dev:add <tipo>` para generar objetos/campos/logic-functions/front-components — mejor que seguir escribiéndolos a mano una vez haya toolchain, porque autogenera los IDs.
2. `yarn add twilio @twilio/voice-sdk` en la app.
3. Crear en la consola de Twilio: cuenta, número de teléfono, API Key, y una TwiML App cuya Voice URL apunte a `<tu servidor>/voip/voice` (todavía no desplegado, así que esto se hace recién cuando haya un servidor accesible públicamente).
4. Implementar las tres logic-functions sobre los bocetos de arriba, confirmando el shape exacto de `RoutePayload` cuando `isAuthRequired: true` (de dónde sale el `workspaceMemberId` del que llama).
5. Implementar el dialer en el front-component con fallback a `tel:`.
6. Probar de punta a punta: mintear token, marcar un número real, confirmar que `/voip/voice` devuelve el TwiML correcto y que `/voip/status` recibe y valida los eventos.
7. Evaluar si conviene extender el objeto `call-recording` existente (ligarlo también a llamadas telefónicas, no solo a bots de videollamada) en vez de crear un objeto nuevo para loguear las llamadas.
