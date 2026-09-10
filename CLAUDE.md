# servicios-altura

Sistema interno de **Servicios de Altura** (trabajos verticales: fachadas, cristales,
impermeabilización, silicón). Un solo objeto de negocio con tres caras:

```
LEVANTAMIENTO  ──►  COTIZACIÓN  ──►  COSTEO
(qué se hace)      (qué se cobra)   (qué deja)
```

Sustituye el PDF de levantamiento (generado hoy con mPDF) y el Excel de costeo de 12 hojas.
Proyecto hermano de `../bodega-instalador/bodega-ia`: misma arquitectura y disciplina de
diseño. Convención de base de datos tomada de `../tapioki-pos`.

## Stack y ejecución

- Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4 (tokens en `src/app/globals.css`).
- `npm run dev` → puerto **3063** · `npm run start` → **3064**.
- Alias `@/*` → `./src/*`. Componentes de servidor por defecto; `"use client"` sólo con interactividad.
- Base propia `BDServiciosAltura` (`src/lib/db.ts`): aquí se lee **y se escribe**.
- `npm run migrar` aplica `sql/esquema.sql` (idempotente).
- `npm run usuario -- <login> <clave> "<Nombre>" <perfil>` da de alta o actualiza un usuario.
- `npm test` corre vitest (el motor de costeo y los lectores de PDF y Excel se prueban
  contra los proyectos 6744 y 6745 reales; los PDF y los `NoC. NNNN ….xlsx` viven en la
  raíz del proyecto).

## Base de datos

Convención de tapioki-pos: tablas `tblXxx`, llaves `IdXxx`, columnas PascalCase,
`Status TINYINT`. Dos mejoras sobre tapioki: `AUTO_INCREMENT` en lugar de `MAX(Id)+1` y
llaves foráneas reales.

- **Catálogos:** `tblUsuarios`, `tblClientes`, `tblPuestos`, `tblEmpleados`, `tblInsumos`,
  `tblParametros`, `tblTarifasMonto`.
- **Levantamiento:** `tblLevantamientos` + `tblLevantamientoActividades` / `…Personal` /
  `…Insumos` / `…Evidencias`.
- **Cotización:** `tblCotizaciones` + `tblCotizacionPartidas`.
- **Costeo:** `tblCosteos` + `tblCosteoConceptos` / `…Nomina` / `…NominaDias` / `…Insumos` / `…Gastos`.
- **Soporte:** `tblImportaciones`, `tblBitacora`.

`tblPuestos` es la fuente de verdad de las tarifas: `SalarioDiario`, `ImssDiario`,
`DesgasteDiario`, `BonoDefault` y `TarifaVentaDia`. Cambiar el salario mínimo es tocar un
renglón, no doce Excel.

`tblCosteoNomina` + `tblCosteoNominaDias` es **una sola matriz persona × día** que reemplaza
las hojas *Nomina*, *Imss* y *Desgaste de Equipo* del Excel, que eran la misma matriz
repetida tres veces con distinta tarifa.

Los cinco porcentajes se **congelan** en `tblCosteos` al crear el costeo: cambiar un
parámetro no altera el histórico.

## Motor de costeo (`src/lib/costeo/motor.ts`)

```
GastoDirecto   = Nómina + IMSS + Bonos + Gasolina + Desgaste + Admvo + EPP + Equipo
Impuestos      = GastoDirecto × 10 %
Administrativos= (GastoDirecto + Impuestos) × 5 %      (5 / 10 / 15 según proyecto)
Insumos        = Σ partidas que aplican                 (los insumos NO son gasto directo)
Financiamiento = Subtotal con insumos × 5 %
GastoTotal     = Subtotal + Financiamiento
UtilidadBruta  = PrecioVenta − GastoTotal
Comisión       = UtilidadBruta × 4 %
UtilidadNeta   = UtilidadBruta − Comisión
```

Reglas que no se pueden romper:

- **La cadena se calcula con precisión completa y sólo se redondea al presentar cada
  renglón.** Redondear paso a paso arrastra el error y deja de cuadrar contra el Excel.
- Los **insumos entran después de los administrativos**, no en el gasto directo.
- Una partida con `Aplica = 0` ("NO APLICAR", material que pone el cliente) **no suma**.
- El **servidor siempre recalcula**: los totales que manda el navegador nunca se guardan.
- `precioPorMargen` es la fórmula invertida `P = G(1−c)/(1−c−m)`. Es lo que el Excel no
  puede hacer.

## Importación de PDF (`src/lib/importacion/`)

```
PDF ─► texto-pdf.ts ─► interpretar.ts + tablas.ts ─► tblImportaciones (REVISION)
        (unpdf,          (función pura: renglones      ─► /dashboard/importar/[id]
         coordenadas)     por coordenadas, tablas         (asistente de 4 pasos ya lleno)
                          por columna)                  ─► POST /api/levantamientos
    └► imagenes-pdf.ts ─► evidencias.ts                      con `importacion.idImportacion`
        (pdf-lib: JPEG      (sharp: 1600 px)                 ─► Origen PDF + evidencias + APLICADA
         crudo, sin logo)
```

- El parser trabaja con **posiciones**, no con el orden del texto: cada celda de la plantilla
  mPDF cae en una columna conocida (metros, puestos, cantidad). Así una actividad que termina
  un renglón en "1.10" no se parte y el nivel de riesgo, que abarca tres filas, no se mezcla.
- `preparar.ts` empata cliente, puestos e insumos contra catálogos; lo que no empata queda
  como captura libre y se avisa. **Nada entra a la base sin pasar por la pantalla de revisión.**
- Al aplicar una importación se respetan el folio y el número de cotización **del papel**; si
  ya existen, se rechaza con 409. En captura manual sigue el consecutivo.
- Los archivos van a `uploads/` (fuera de `public/`) y los entrega `/uploads/[...ruta]` con
  sesión propia (no confiar sólo en el proxy). `unpdf` va en `serverExternalPackages`.
- Con `proxy.ts` presente, Next clona el cuerpo de cada petición y lo **corta a 10 MB** en
  silencio; por eso `next.config.ts` sube `experimental.proxyClientMaxBodySize` a 40 MB
  (el 6744.pdf pesa 15 MB). Si una subida grande llega truncada, revisar ese valor primero.

## Importación de Excel (`src/lib/importacion/excel/`)

```
.xlsx ─► celdas.ts + hojas.ts ─► interpretar.ts ─► tblImportaciones (REVISION)
          (exceljs; celdas por     (función pura:      ─► /dashboard/importar/[id]
           etiqueta, no por          encabezado, cadena,   RevisionCosteo: todo editable,
           coordenadas fijas)        9 conceptos, tres     motor en vivo + cuadre con el Excel
                                     matrices persona×día ─► POST /api/costeos
                                     fundidas por nombre)     ─► cotización + costeo + APLICADA
```

- La plantilla es fija pero **se lee por etiquetas** ("Usuario:", "Costo sin Iva",
  "TRABAJADOR"…), así que aguanta filas corridas. Los porcentajes salen de las fórmulas
  (impuestos/gasto directo, etc.), no se asumen.
- Las hojas *Nomina*, *Imss* y *Desgaste de Equipo* son la misma matriz con distinta tarifa:
  se funden por nombre en una sola persona con `dias`, `salarioDiario`, `imssDiario`,
  `desgasteDiario` y `bono` (de la hoja *Bonos*). Quien tiene desgaste sólo en algunos días
  queda prorrateado y se avisa. Las fechas de la matriz son las de la plantilla (enero), se
  ignoran: los días se cuentan y se cuelgan de la fecha de emisión.
- El motor recalcula todo; los totales del Excel (`gastoTotalExcel`, `utilidadNetaExcel`)
  sólo sirven para el chip «Cuadra al peso» de la revisión. Con los dos archivos reales
  cuadra al centavo.
- Si el folio del Excel existe como levantamiento **sin cotización**, la cotización se liga y
  el levantamiento pasa a COTIZADO; si ya tiene cotización o no existe, se guarda sola.
  "AUTORIZA …" en la celda junto al precio → cotización AUTORIZADA con `AutorizadoPor`.
- El gasto real sólo se guarda si el Excel lo trae distinto del plan (entonces el costeo
  nace EN_PROCESO); si no, queda PLANEADO con reales en 0.
- `.xls` (BIFF) se rechaza con instrucción de guardar como `.xlsx`. `exceljs` va en
  `serverExternalPackages`.
- `src/lib/costeo/guardar.ts` es el **único** lugar que escribe cotización + costeo; lo usan
  tanto la captura manual (`/api/levantamientos`) como la importación (`/api/costeos`).

## Edición, documentos y tablero

- **Edición.** Levantamiento: el mismo `AsistenteCaptura` en `modo="editar"` (`/levantamientos/[id]/editar`,
  `PUT /api/levantamientos/[id]`); si aún no tiene cotización, `?paso=3` abre el paso 4 y el PUT
  la genera. Cotización: `EditorCotizacion` (`/cotizaciones/[id]/editar`, `PUT /api/cotizaciones/[id]`):
  partidas, descuento, vigencia, condiciones y estatus; si hay costeo, `recalcularPrecioCosteo`
  lo vuelve a correr con la nueva base. Costeo: `RevisionCosteo` con `idCosteo`
  (`/costeos/[id]/editar`, `PUT /api/costeos/[id]`): se borra el detalle y se reinserta recalculado
  (`reemplazarCosteo`). Los esquemas Zod viven en `lib/*/esquemas.ts` y los comparten POST y PUT.
- **Cadena del proyecto.** `EncabezadoProyecto` pinta las tres caras arriba de cada ficha con
  `cadenaDe*` (`lib/consultas/proyectos.ts`). `AccionesEstado` cambia estatus llamando al mismo
  `POST /api/tablero/mover` que usa el Kanban: las reglas de transición viven **sólo** en
  `lib/tablero/columnas.ts` (`cambiosParaColumna`, con pruebas).
- **Tablero** (`/dashboard/tablero`): una tarjeta por proyecto (`tarjetasTablero`), ocho columnas
  que siguen el flujo, arrastre nativo sin librerías, movimiento optimista con reversión si el
  servidor dice que no.
- **Documentos** (`GET /api/documentos/{levantamiento|cotizacion|costeo}/{id}/{pdf|excel}`):
  PDF con `jspdf` + `jspdf-autotable` en el servidor (`lib/documentos/pdf-*.ts`; el logo se
  aplana a JPEG con sharp; `limpiar()` quita los caracteres que las fuentes base del PDF no
  saben). Excel con `exceljs`. **El Excel del costeo reproduce las 12 hojas de la plantilla**
  con fórmulas y resultados cacheados, y se vuelve a importar sin avisos (prueba de ida y vuelta
  en `excel-costeo.test.ts`). Ambos van en `serverExternalPackages`.

## Dirección de diseño: "cuarto de control"

Panel de operación que se usa todos los días: denso, tranquilo, escaneable. Fondo **navy**
(`#051622` / `#0a2233`) con acento **amarillo** (`#f5c400`) — la misma identidad de
`../servicios-altura-page`. El amarillo se gana donde hay algo que tocar o decidir (botón
primario, pestaña activa, foco); nunca decorativo. Texto sobre amarillo siempre navy,
nunca blanco.

El logo oficial es `public/logo.png` (sello con el escalador). `Marca`
(`src/components/layout/Marca.tsx`) lo pinta con `next/image`; no redibujar el logo a mano.

Tokens Tailwind (en `globals.css`; úsalos siempre, nunca hex sueltos):

| Clase | Uso |
|---|---|
| `bg-fondo` / `bg-superficie` / `bg-superficie-2` | fondo de página / tarjetas / celdas elevadas |
| `border-borde` / `border-borde-fuerte` | filete normal / con peso |
| `text-tinta` / `text-tinta-2` / `text-tinta-3` | texto principal / secundario / apagado |
| `bg-acento` (hover `bg-acento-press`) · `text-acento` | EXCLUSIVO de acción y estado activo |
| `text-bueno` · `text-alerta` · `text-serio` · `text-critico` | estados; siempre con icono o etiqueta |
| `--color-series-1..6` | series de gráficas; jamás para texto |
| `.linea-marca` | filete amarillo de 3 px que remata la barra lateral y el panel de acceso |
| `.num-tab` | cifras en columnas, mono tabular |
| `.display` | títulos y KPIs en Barlow Condensed |
| `.etiqueta` | etiqueta pequeña de sección, mono, versalitas |

Tipografía: `font-display` = Barlow Condensed (títulos, KPIs), `font-sans` = Manrope (UI),
`font-mono` = Roboto Mono (claves, cifras en columnas).

Semáforo de margen, en toda la aplicación: verde ≥ 45 %, ámbar 30-45 %, rojo < 30 %
(`semaforoMargen`, umbrales en `tblParametros`).

Gráficas: SVG propio en `src/components/graficas/` siguiendo el skill dataviz — barras
≤ 24 px con punta redondeada 4 px, cuadrícula hairline recesiva, un solo eje, leyenda con
≥ 2 series. Sin librerías de gráficas ni de animación; transiciones CSS de 150 ms.

Copy: español mexicano, tuteo, directo. Dinero en MXN con `formatoMoneda`. Fechas `dd mmm yyyy`.

## Estado

- **Fase 1 (hecha):** esquema y semilla, sesión y perfiles, cascarón, panel, captura manual
  de 4 pasos con costeo en vivo, listas y fichas de levantamiento, cotización y costeo,
  catálogos de sólo lectura.
- **Fase 2 (casi):** PDF y Excel de levantamiento, cotización y costeo; edición de los tres;
  evidencias fotográficas (vía importación de PDF). Pendiente: edición de catálogos y captura de
  fotos desde el asistente.
- **Fase 3 (casi):** importadores de PDF y de Excel hechos (ver arriba). Pendiente: respaldo
  con IA cuando el archivo no cuadre con la plantilla.
- **Fase 4:** plan contra real capturado en campo y asistente de consulta en español.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
