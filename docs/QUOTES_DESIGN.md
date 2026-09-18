# Cotizaciones y contratos — diseño

Diseño del diferencial P1 "cotizaciones/contratos" listado en `docs/CRM_DESIGN_DOCUMENT.md`. A diferencia del portal de autoservicio (que es infraestructura de auth en el schema `core`), esto es un objeto de negocio — mismo tipo de pieza que `Case` en la integración con AsistentesPersonales.

## Hallazgo clave: no hace falta construir esto desde cero

`packages/twenty-apps/examples/document-generator/` ya es una app de Twenty completa y funcional que resuelve exactamente "plantilla → PDF → adjuntar al registro → link público para verlo" — es el tutorial oficial de la SDK, corre sin API externa (usa `pdf-lib` + `marked`, ambas MIT, cero costo por documento), y ya está en este monorepo. En vez de diseñar un mecanismo nuevo, este módulo es una app hermana que reusa el mismo patrón: objetos vía `defineObject`, generación de PDF con `pdf-lib`, y una página pública vía `defineLogicFunction` con `isAuthRequired: false`.

**Decisión: es una Application separada** (`packages/twenty-apps/internal/quotes/`), no una modificación del core de Twenty ni de la app `document-generator` de ejemplo (esa se deja intacta como referencia). Mismo razonamiento que ya aplicamos en el portal: la SDK de Apps es la vía sancionada para agregar objetos de negocio sin heredar AGPLv3 sobre el core.

### Progreso

| Pieza | Estado |
|---|---|
| `package.json`, `application-config.ts` | ✅ Archivos reales, adaptados de `document-generator` |
| `constants/universal-identifiers.ts` | ✅ Archivo real, con UUIDs propios generados para esta app |
| Objeto `Quote` (`objects/quote.object.ts`) | ✅ Archivo real |
| Objeto `QuoteLine` (`objects/quote-line.object.ts`) | ✅ Archivo real |
| Relación `Quote` ↔ `QuoteLine` (`fields/quote-quote-lines-relation.field.ts`, `fields/quote-line-quote-relation.field.ts`) | ✅ Archivos reales |
| Rol por defecto (`roles/default-role.ts`) | ⚠️ Pendiente — no lo escribí a ciegas, define permisos CRUD finos |
| Generación de PDF (`generate-quote-pdf.ts`) | 📝 Boceto (ver abajo) |
| Página pública de aceptación (`accept-quote.ts`) | 📝 Boceto (ver abajo) |
| Envío por email, vistas, layouts, navegación | 📝 Pendiente, no diseñado en detalle todavía |

**Limitación de este entorno**: igual que con el portal, no tengo Node 24 ni el CLI `twenty` acá, así que nada de esto se compiló ni se instaló contra un workspace real. Los objetos siguen el patrón verificado línea por línea contra `document.object.ts`/`document-template.object.ts` y las validaciones reales de `defineObject`/`defineApplication` (leí el código fuente de la SDK, no adiviné la forma), así que el riesgo de estar mal es bajo — pero "bajo" no es "probado".

## Modelo de datos

**`Quote`** (cubre tanto cotización como contrato, distinguidos por `kind`):

| Campo | Tipo | Notas |
|---|---|---|
| `name` | Texto | Identificador legible, ej. "Acme — plan anual" |
| `kind` | Select | `Quote` \| `Contract` |
| `status` | Select | `Draft` → `Sent` → `Accepted` \| `Declined` \| `Expired` |
| `validUntil` | Fecha | Vencimiento |
| `terms` | Rich text | Términos del contrato o notas de la cotización, se renderizan arriba de los line items en el PDF |
| `subtotal` / `taxRate` / `total` | Currency / Number / Currency | Calculados al generar el PDF, no editables a mano |
| `file` | Archivo (1) | El PDF generado |
| `acceptedByName` / `acceptedByEmail` / `acceptedAt` | Texto / Texto / Fecha | Capturados en la página pública de aceptación |
| `quoteLines` | Relación 1→N | Line items (ver abajo) |

**`QuoteLine`**: `description` (texto), `quantity` (número), `unitPrice` (currency), `lineTotal` (currency, calculado), `quote` (relación N→1, `CASCADE` — una línea sin su cotización no tiene sentido).

**Pendiente de decidir**: relacionar `Quote` con `Opportunity`/`Company`/`Person` (para saber a quién/qué trato pertenece). No lo agregué todavía porque quiero primero validar que el objeto base compila en un entorno real antes de sumarle relaciones a objetos estándar de Twenty — es la clase de cosa que preferí no adivinar en dos frentes a la vez.

## Generación de PDF — boceto

En vez de reusar tal cual `generateDocumentPdf` (que renderiza Markdown libre), un PDF de cotización necesita layout tabular (línea, cantidad, precio, total, y el total general). Boceto basado exactamente en el mismo uso de `pdf-lib` que ya está probado en `document-generator`:

```ts
// logic-functions/utils/generate-quote-pdf.ts — BOCETO, no compilado
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const generateQuotePdf = async (quote: {
  name: string;
  terms: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
  taxRate: number;
}): Promise<{ pdfBytes: Uint8Array; subtotal: number; total: number }> => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4, igual que document-generator

  // ... encabezado con quote.name, tabla de líneas (descripción/cantidad/precio/total por fila),
  // línea de subtotal/impuesto/total al pie — mismo estilo de dibujo por coordenadas
  // que ya usa drawBlocks()/drawRuns() en generate-document-pdf.ts.

  const subtotal = quote.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const total = subtotal * (1 + quote.taxRate / 100);

  return { pdfBytes: await pdf.save(), subtotal, total };
};
```

Esto se invocaría desde un `command-menu-item` sobre el registro `Quote` (mismo patrón que `generate-document.command-menu-item.ts`), que guarda el PDF en el campo `file`, escribe `subtotal`/`total`, y pasa `status` a `Sent`.

## Página pública de aceptación — boceto

`document-generator` ya prueba el patrón exacto que necesitamos para esto: una ruta HTTP pública definida con `defineLogicFunction` + `httpRouteTriggerSettings: { isAuthRequired: false }` (ver `view-document.ts`, que sirve `<server>/s/documents/view?id=...`). Para cotizaciones son dos rutas en ese mismo patrón:

```ts
// logic-functions/view-quote.ts — BOCETO, calcado de view-document.ts
// GET /s/quotes/view?id=<quoteId> — muestra el PDF/detalle + un formulario "Aceptar"

// logic-functions/accept-quote.ts — BOCETO
// POST /s/quotes/accept — recibe { quoteId, name, email } del formulario,
// escribe acceptedByName/acceptedByEmail/acceptedAt y status=Accepted vía CoreApiClient,
// igual que view-document.ts usa CoreApiClient para leer.
```

### Sobre la "firma"

Esto es una **captura de aceptación** (nombre + email tipeados + timestamp), no una firma electrónica criptográfica tipo DocuSign/HelloSign. Es deliberado y tiene precedente directo en este mismo repo: el módulo `dpa/` de Twenty (con el que la propia empresa hace firmar sus contratos DPA a los clientes) usa exactamente el mismo mecanismo — `acceptedByEmail`, `acceptedAt`, sin proveedor externo de firma (`dpa-agreement.entity.ts`, ver `docs/FUNCTIONAL_MAP.md`). Si en algún momento hace falta una firma con validez legal reforzada, se integra un proveedor externo (DocuSign, HelloSign) como paso posterior — no es parte de este MVP.

## Envío del PDF al cliente

Pendiente de diseñar en detalle. Opciones a evaluar cuando se retome: usar la tool `email-tool` que ya usan los agentes de IA (`docs/FUNCTIONAL_MAP.md` § 4) para enviar el link + PDF adjunto, o un logic-function propio que llame al servicio de email transaccional. No hay una decisión tomada todavía.

## Próximos pasos

1. Definir `roles/default-role.ts` (qué puede hacer quién con `Quote`/`QuoteLine` — mirar `document-generator/src/roles/default-role.ts` como referencia antes de escribirlo).
2. Copiar el resto del boilerplate de la app (`tsconfig.json`, `tsconfig.spec.json`, `.oxlintrc.json`, `.yarnrc.yml`, `.nvmrc`) desde `document-generator`, adaptado al nombre de este paquete.
3. Escribir `generate-quote-pdf.ts` y probarlo (tiene tests de referencia en `document-generator/src/logic-functions/utils/__tests__/generate-document-pdf.test.ts` que muestran cómo se testea sin necesitar Postgres).
4. Escribir `view-quote.ts` / `accept-quote.ts`.
5. Vistas, layout de registro y navegación (mirror de `documents.view.ts`, `document-record.page-layout.ts`, `documents.navigation-menu-item.ts`).
6. Decidir la relación con `Opportunity`/`Company`/`Person`.
7. Instalar la app en un workspace real (`npx twenty app:publish --private` o el flujo de dev de apps) y probar el flujo completo: crear Quote → agregar líneas → generar PDF → mandar link → aceptar desde afuera → ver el estado `Accepted` reflejado en el CRM.
