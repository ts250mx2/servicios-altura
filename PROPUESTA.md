# Servicios de Altura — Dashboard de Levantamientos, Cotización y Costeo

Propuesta técnica · 10-sep-2026

Base: diseño y arquitectura de `bodega-instalador/bodega-ia`, convención de base de datos
de `tapioki-pos`, identidad visual de `servicios-altura-page`.

---

## 1. Qué resuelve

Hoy el flujo vive en dos artefactos sueltos:

| Artefacto | Qué es | Ejemplo |
|---|---|---|
| PDF `Levantamiento NNNN` (mPDF) | Lo que se va a hacer: actividades, personal por puesto, insumos, herramental, días, nivel de riesgo, evidencias fotográficas | `6744.pdf` (folio 3434), `6745.pdf` (folio 3435) |
| Excel `NoC. NNNN ...` (12 hojas) | Lo que cuesta y lo que deja: nómina diaria, IMSS, bonos, insumos, gasolina, desgaste, EPP, equipo → utilidad | `NoC. 6744 ...xlsx`, `NoC. 6745 ...xlsx` |

El Excel se re-teclea a mano por proyecto, las fórmulas se rompen (`#REF!` en la hoja *Equipo*
del 6744), las fechas de la plantilla quedan en enero-2026 o mayo-2020, y no hay forma de ver
la cartera completa: cuánto cotizado, cuánto autorizado, qué margen real por cliente o vendedor.

**La propuesta es un solo objeto de negocio con tres caras:**

```
LEVANTAMIENTO  ──►  COTIZACIÓN  ──►  COSTEO
(qué se hace)      (qué se cobra)   (qué deja)
   folio 3434         no. 6744       plan vs real
```

Un levantamiento genera su cotización; la cotización genera su costeo; los tres comparten
personal, días e insumos, así que se capturan **una sola vez**.

---

## 2. Arquitectura

Idéntica a `bodega-ia`, que ya está probada:

- **Next.js 16** App Router + React 19 + TypeScript, componentes de servidor por defecto.
- **Tailwind CSS 4** con tokens propios en `src/app/globals.css`.
- **MySQL** con `mysql2` (pool), base propia `BDServiciosAltura` — aquí sí se escribe.
- **Sesión JWT** en cookie httpOnly con `jose`, contraseñas con `bcryptjs`, perfiles.
- **PDF** con `jspdf` + `jspdf-autotable` (cotización al cliente y hoja de levantamiento).
- **Gráficas SVG propias** (`src/components/graficas/`), sin librerías.
- Puertos sugeridos: `dev 3063` / `start 3064` (libres respecto a bodega-ia 3061/3062,
  tapioki 3015/3016, la landing 3040).

**Nomenclatura de BD: la de tapioki-pos** — tablas `tblXxx`, llaves `IdXxx`, columnas
PascalCase, `Status TINYINT`, InnoDB + utf8mb4. Dos mejoras sobre tapioki que sí conviene
tomar: `AUTO_INCREMENT` en lugar de `MAX(Id)+1` (evita choques con dos capturistas) y llaves
foráneas reales.

**Nomenclatura de código: la de bodega-ia** — carpetas y funciones en español
(`src/lib/consultas/`, `src/lib/costeo/`, `Cascaron`, `BarraLateral`, `formatoMoneda`).

---

## 3. Modelo de datos

Doce tablas de operación + seis catálogos. El esquema ejecutable está en
`sql/esquema.sql`; aquí va el mapa.

### Catálogos

| Tabla | Para qué |
|---|---|
| `tblUsuarios` | Acceso al dashboard. Perfiles: `administrador`, `ventas`, `operaciones`, `campo`. Liga opcional a vendedor y su `ComisionPct`. |
| `tblClientes` | Iglesia San Juan de los Lagos, etc. Con contacto, correo y planta/sede. |
| `tblPuestos` | TÉCNICO, SUPERVISOR, AYUDANTE, SUP. SEG., VIGÍA. **Aquí viven las tarifas**: `SalarioDiario` (700), `ImssDiario` (51.30), `DesgasteDiario` (100), `BonoDefault` (800) y `TarifaVentaDia` (precio de venta por persona-día). Cambiar el salario mínimo es tocar un renglón, no doce Excel. |
| `tblEmpleados` | Marcos Tovar, Luis Moreno, Alfredo, Alan Cruz… con su puesto y sus tarifas propias si difieren. |
| `tblInsumos` | Cartuchos de silicón Duretán, maskingtape 3/4", cubetas de impermeabilizante, exactos, atomizadores. Con `CostoUnitario` y bandera `EsHerramental`. |
| `tblParametros` | Los porcentajes del costeo: impuestos 10 %, administrativos 5/10/15 %, financiamiento 5 %, comisión vendedor 4 %, ISR fijo 1,000, IVA 16 %. |
| `tblTarifasMonto` | La hoja *Tabla de montos*: escalones de EPP y compra de equipo por monto de venta. |

### Levantamiento

| Tabla | Contenido |
|---|---|
| `tblLevantamientos` | Folio (3434), cliente, proyecto, área de trabajo, usuario y su correo, responsable, fecha, **nivel de riesgo**, días, tiempo normal / extra, aplica cena, aplica bono, observaciones, elaboró / recibió / revisó, `Origen` (`MANUAL`, `PDF`, `EXCEL`), `Status` (`BORRADOR`, `CERRADO`, `COTIZADO`, `CANCELADO`). |
| `tblLevantamientoActividades` | Los pasos del "TRABAJO A REALIZAR", en orden, con metros. |
| `tblLevantamientoPersonal` | Por puesto: cantidad, si aplica T. extra, si aplica bono. (6744: 4 técnicos + 1 sup. seg. + 1 vigía.) |
| `tblLevantamientoInsumos` | Insumos y herramental con cantidad y bandera `Aplica` — el 6745 trae tres partidas marcadas "NO APLICAR" porque las pone el cliente. |
| `tblLevantamientoEvidencias` | Las fotos del PDF (el 6744 trae tres de 1440×3200 y 1836×4080). |

### Cotización

`tblCotizaciones` (no. 6744, vigencia, subtotal, IVA, total, condiciones, `Status`:
`BORRADOR` → `ENVIADA` → `AUTORIZADA` / `RECHAZADA`, quién autorizó y cuándo) +
`tblCotizacionPartidas` (concepto, unidad, cantidad, precio unitario, importe).

### Costeo

| Tabla | Contenido |
|---|---|
| `tblCosteos` | Un renglón por cotización: precio de venta, los cinco porcentajes **congelados al momento** (para que cambiar un parámetro no altere el histórico), gasto plan, gasto real, utilidad y margen. |
| `tblCosteoConceptos` | Los nueve renglones de la tabla resumen: nómina, IMSS, bonos, gasolina, desgaste, administrativo, insumos, EPP, equipo — cada uno con plan, real y diferencia. |
| `tblCosteoNomina` | Persona × día. Reemplaza las hojas *Nomina*, *Imss* y *Desgaste de Equipo*, que hoy son la misma matriz repetida tres veces con distinta tarifa. Una sola matriz, tres tarifas por renglón. |
| `tblCosteoInsumos` | Concepto, unidades, costo plan, costo real, fecha, comentario. |
| `tblCosteoGastos` | Gastos sueltos con fecha: gasolina con ruta, administrativos, EPP, compra de equipo. |
| `tblImportaciones` | Bitácora de cada archivo subido: nombre, tipo, JSON extraído, qué se creó, errores. |

---

## 4. Motor de costeo

La cadena del Excel, verificada contra los dos casos:

```
GastoDirecto   = Nómina + IMSS + Bonos + Gasolina + Desgaste + Administrativo + EPP + Equipo
Impuestos      = GastoDirecto × 10 %
Subtotal 1     = GastoDirecto + Impuestos
Administrativos= Subtotal 1 × 5 %          (configurable 5 / 10 / 15 %)
Subtotal 2     = Subtotal 1 + Administrativos
Insumos        = Σ partidas de insumos
Subtotal 3     = Subtotal 2 + Insumos
Financiamiento = Subtotal 3 × 5 %
GastoTotal     = Subtotal 3 + Financiamiento
UtilidadBruta  = PrecioVenta − GastoTotal
Comisión       = UtilidadBruta × 4 %
UtilidadNeta   = UtilidadBruta − Comisión
Margen         = UtilidadNeta ÷ PrecioVenta
```

Comprobación:

| | 6744 | 6745 |
|---|---:|---:|
| Gasto directo | 31,939.00 | 21,376.00 |
| Insumos | 14,942.00 | 1,235.00 |
| Gasto total | 54,423.12 | 27,220.49 |
| Precio de venta | 130,800.00 | 55,440.99 |
| Utilidad neta | **73,321.80** | **27,091.67** |
| Margen | **56.1 %** | **48.9 %** |

Cuadra al centavo con las celdas C20/C23 de ambos archivos.

**Lo que el Excel no puede hacer y el dashboard sí:** invertir la fórmula. Fijas el margen
objetivo y sale el precio:

```
PrecioVenta = GastoTotal × (1 − comisión) ÷ (1 − comisión − margenObjetivo)
```

Tres modos de precio en la misma pantalla, con el margen resultante siempre visible:

1. **Por tarifa** — personas × días × `TarifaVentaDia` del puesto (+ bonos). Así se armó el
   6744: 6 personas × 5 días × $4,200 = $126,000 + $4,800 de bonos = **$130,800**.
2. **Por margen objetivo** — pones 50 % y sale el precio.
3. **Manual** — capturas el precio y ves qué margen deja antes de mandarla.

---

## 5. Captura: los tres caminos

### a) Manual — asistente de 4 pasos

Un solo formulario largo dividido en pasos, con guardado automático en borrador:

1. **Datos** — cliente, proyecto, área, usuario y correo, responsable, fecha, nivel de riesgo, días.
2. **Trabajo** — actividades (agregar renglón, arrastrar para ordenar, metros) y observaciones.
3. **Recursos** — personal por puesto con `+`/`−`, insumos y herramental con autocompletado
   del catálogo (escribes "silicón" y sale con su costo).
4. **Resultado** — el costeo se calcula en vivo mientras capturas: al terminar el paso 3 ya
   estás viendo gasto, precio sugerido y margen. Ahí decides el precio y generas cotización.

El paso 4 es lo que hace que valga la pena: hoy el margen se conoce después, al llenar el
Excel. Aquí se conoce **mientras** se levanta.

### b) Subir PDF de levantamiento

Los PDFs los genera mPDF con plantilla fija, así que el parseo es determinista: se extrae el
texto con `pdf-parse`, se cortan las secciones por sus encabezados (`NO. COTIZACIÓN`, `FOLIO`,
`FECHA`, `PROYECTO`, `ÁREA DE TRABAJO`, `CLIENTE`, `TRABAJO A REALIZAR`, `CANTIDAD DE
PERSONAL`, `INSUMOS`, `HERRAMENTAL`, `DÍAS`) y las fotos salen con `pdfimages` a
`/uploads/evidencias/`. Probado contra los dos archivos: extrae las 3 actividades y 6 insumos
del 6744 y las 6 actividades y 5 insumos del 6745.

### c) Subir Excel de costeo

Con `exceljs`. La plantilla también es fija: `B3` usuario, `G3` cotización, `G4` folio,
`G5` días, `G6` personal, `B7` vendedor, `D7` fecha, `C10`…`C23` la cadena de costeo, y las
hojas *Insumos*, *Bonos*, *Nomina*, *Imss* y *Gasolina* renglón por renglón. Verificado: las
12 hojas de ambos archivos tienen exactamente la misma estructura.

### Red de seguridad para (b) y (c)

Si el archivo no cuadra con la plantilla (alguien movió una celda, o llega un formato viejo),
el texto se manda a **Claude** con un esquema Zod y regresa el mismo JSON. Nunca falla la
importación por un renglón corrido.

**Y en los tres casos, pantalla de revisión antes de guardar:** lado izquierdo el archivo
original, lado derecho los campos extraídos, todos editables, cada uno con semáforo de
confianza. Nada entra a la base sin que alguien lo vea. Esto es lo que separa un importador
que se usa de uno que se abandona.

---

## 6. Pantallas

| Ruta | Qué muestra |
|---|---|
| `/panel` | KPIs del periodo contra el anterior: levantamientos, cotizado, autorizado, utilidad y margen promedio. Embudo levantamiento → cotización → autorizada. Tendencia 12 meses. Margen por cliente y por vendedor. Proyectos en curso. |
| `/levantamientos` | Lista con filtros (cliente, estatus, riesgo, periodo), botón **Nuevo** y zona de arrastre para PDF/Excel. |
| `/levantamientos/[folio]` | Ficha completa con actividades, personal, insumos, herramental y galería de evidencias. Botones: *Generar cotización*, *Imprimir hoja*, *Duplicar*. |
| `/cotizaciones` | Embudo, antigüedad de abiertas, conversión por vendedor. |
| `/cotizaciones/[no]` | Partidas, PDF para el cliente, autorizar / rechazar, liga al costeo. |
| `/costeos` | Todas con semáforo de margen (verde ≥ 45 %, ámbar 30-45 %, rojo < 30 %) y desviación plan vs real. |
| `/costeos/[id]` | La hoja de costeo completa: cadena de cálculo, los nueve conceptos plan/real/diferencia, matriz de nómina por día, insumos, gastos. Exporta al mismo Excel de siempre para quien lo siga pidiendo. |
| `/catalogos/*` | Clientes, puestos y tarifas, empleados, insumos, parámetros, tabla de montos. |
| `/importar` | Historial de importaciones con su resultado y liga a lo que generaron. |
| `/asistente` *(fase 2)* | Chat sobre la base: "¿cuál fue el margen promedio en impermeabilización este trimestre?" |

---

## 7. Diseño

Reutilizo la identidad que ya existe en `servicios-altura-page` — misma marca, dos
superficies distintas:

| | Landing | Dashboard |
|---|---|---|
| Fondo | claro (`--ice #f6f9f8`) | oscuro navy (`#061a29` / `#0a2639`) |
| Acento | amarillo `#f5c400` | el mismo `#f5c400` |
| Títulos | Barlow Condensed | Barlow Condensed (encabezados y KPIs) |
| Texto | Manrope | Manrope |
| Cifras | Roboto Mono | Roboto Mono tabular en columnas |

Dirección, tomada de bodega-ia y adaptada: **panel de operación denso, tranquilo y
escaneable**. Navy neutro de fondo, el amarillo se gana sólo donde hay algo que tocar o
decidir (botón primario, pestaña activa, foco) — nunca decorativo. Texto sobre amarillo
siempre navy, nunca blanco. Estados (bueno / alerta / serio / crítico) siempre con icono o
etiqueta, nunca color solo. El logo del sello con el escalador va en blanco sobre el navy,
tal cual, sin redibujar.

---

## 8. Entrega por fases

| Fase | Contenido | Estimado |
|---|---|---|
| **1 — Núcleo** | Esquema MySQL + seed de catálogos con tus tarifas reales, login y perfiles, cascarón del dashboard con la identidad, CRUD de levantamiento manual (los 4 pasos) y motor de costeo con las tres formas de precio | 2-3 sesiones |
| **2 — Documentos** | Cotización con PDF al cliente, hoja de levantamiento imprimible, exportación al Excel de siempre, evidencias fotográficas | 1-2 sesiones |
| **3 — Importación** | Parser de PDF, parser de Excel, pantalla de revisión, respaldo con Claude, bitácora | 2 sesiones |
| **4 — Inteligencia** | Panel con gráficas, plan vs real, semáforos de margen, asistente de consulta en español | 2 sesiones |

Al terminar la fase 1 ya se puede trabajar con el sistema. La 3 es la que mata el re-tecleo
del histórico: se sueltan los PDFs y Excel viejos y el histórico se llena solo.

---

## 9. Decisiones pendientes

1. **¿Base nueva o hay algo atrás?** El PDF lo produce mPDF (PHP) con folio consecutivo
   3434/3435 y cotización 6744/6745 — o sea, ya existe un sistema que emite levantamientos.
   Si tiene MySQL detrás, conviene leer de ahí en vez de recapturar; si no, arrancamos base
   nueva e importamos los archivos.
2. **Tarifa de venta por puesto.** El 6744 salió a $4,200 por persona-día; el 6745 a $2,772.
   ¿Hay tabla oficial por tipo de trabajo, o el precio siempre se negocia y la tarifa es sólo
   una sugerencia?
3. **Quién captura.** Si el levantamiento lo hace el técnico en sitio desde el celular,
   el asistente de captura tiene que ser responsive de verdad y aceptar fotos desde la cámara.
