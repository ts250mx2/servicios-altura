# Servicios de Altura — levantamientos, cotización y costeo

Dashboard interno para proyectos de trabajo vertical. Sustituye el PDF de levantamiento y
el Excel de costeo de 12 hojas por un solo flujo:

```
LEVANTAMIENTO  ──►  COTIZACIÓN  ──►  COSTEO
(qué se hace)      (qué se cobra)   (qué deja)
```

Se captura una vez y el margen se conoce **mientras** se levanta, no después.

## Puesta en marcha

```powershell
npm install
copy .env.example .env       # llena DB_* y JWT_SECRET
npm run migrar               # crea BDServiciosAltura, tablas y catálogos base
npm run usuario -- admin TuClave "Nombre Apellido" administrador
npm run dev                  # http://localhost:3063
```

Producción: `npm run build && npm run start` (puerto 3064).

### Variables de entorno

| Variable | Uso |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL de la aplicación |
| `JWT_SECRET` | Firma de la cookie de sesión (cadena larga y aleatoria) |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Respaldo de importación y asistente (fases 3-4) |

Perfiles de usuario: `administrador`, `ventas`, `operaciones`, `campo`.

## Módulos

| Ruta | Qué muestra |
|---|---|
| `/dashboard` | KPIs del periodo contra el anterior, cotizado vs. autorizado por mes, embudo, margen por cliente, últimos levantamientos |
| `/dashboard/levantamientos` | Lista con filtros por folio, cliente, estatus y riesgo |
| `/dashboard/levantamientos/nuevo` | Asistente de captura en 4 pasos con costeo en vivo. `?modo=campo` para el técnico en sitio (sin paso de costeo) |
| `/dashboard/levantamientos/[id]` | Ficha: actividades, personal, insumos, herramental, evidencias |
| `/dashboard/cotizaciones` | Cotizaciones con antigüedad, margen y estatus |
| `/dashboard/costeos` | Todos los costeos con semáforo de margen y desviación plan vs. real |
| `/dashboard/costeos/[id]` | Cadena de cálculo completa, nueve conceptos plan/real, nómina y gastos |
| `/dashboard/cotizaciones/[id]` | Partidas, totales, estado de la respuesta del cliente y condiciones |
| `.../editar` | Edición de levantamiento, cotización y costeo; el servidor recalcula al guardar |
| `/dashboard/tablero` | Kanban de proyectos por etapa; arrastrar una tarjeta cambia su estatus |
| `/api/documentos/{tipo}/{id}/{pdf\|excel}` | PDF para imprimir o Excel de cada cara (el del costeo es el libro de 12 hojas de siempre) |
| `/dashboard/catalogos` | Puestos y tarifas, parámetros del costeo, clientes, insumos, empleados |
| `/dashboard/importar` | Zona para subir la hoja de levantamiento (PDF) o el Excel de costeo (.xlsx) e historial de importaciones |
| `/dashboard/importar/[id]` | Revisión de lo extraído. PDF: el asistente de 4 pasos ya lleno, con avisos y fotos. Excel: cotización, nómina, insumos y gastos editables con el costeo en vivo y el cuadre contra el archivo. Nada entra a la base hasta guardar |

## Importar el histórico

Los PDF de levantamiento y los Excel `NoC. NNNN …xlsx` de siempre se sueltan en
`/dashboard/importar`. Cada archivo se lee, queda «En revisión» y se abre una pantalla con
todo lo extraído ya lleno y editable; nada se guarda hasta que alguien lo revisa. El Excel
crea la cotización y el costeo completos (nómina persona × día, insumos, gastos, utilidad) y,
si el folio ya existe como levantamiento, los liga. Los `.xls` viejos hay que guardarlos
como `.xlsx` antes.

## El motor de costeo

Está en `src/lib/costeo/motor.ts` y reproduce exactamente la hoja *Gastos proyecto* del
Excel:

```
GastoDirecto   = Nómina + IMSS + Bonos + Gasolina + Desgaste + Admvo + EPP + Equipo
Impuestos      = GastoDirecto × 10 %
Administrativos= (GastoDirecto + Impuestos) × 5 %
Insumos        = Σ partidas que aplican
Financiamiento = (Subtotal + Insumos) × 5 %
GastoTotal     = Subtotal + Insumos + Financiamiento
UtilidadNeta   = (PrecioVenta − GastoTotal) × (1 − 4 % de comisión)
```

`npm test` verifica la cadena contra los proyectos reales **6744** (utilidad 73,321.80,
margen 56.1 %) y **6745** (utilidad 27,091.67, margen 48.9 %).

Como el motor está en código, la fórmula se puede invertir. Hay tres formas de fijar el
precio, todas con el margen resultante a la vista:

1. **Por tarifa** — personas × días × `TarifaVentaDia` del puesto, más bonos.
   Así salió el 6744: 6 personas × 5 días × $4,200 + $4,800 = **$130,800**.
2. **Por margen objetivo** — `P = G(1−c)/(1−c−m)`.
3. **Manual** — capturas el precio y ves qué margen deja antes de mandarla.

## Verificación

```powershell
npm test          # vitest: motor de costeo y lectores de PDF y Excel contra los proyectos 6744 y 6745
npm run lint
npx tsc --noEmit
npm run build
```

## Estructura

```
sql/esquema.sql          esquema y semilla (idempotente)
uploads/                 PDF originales y fotos de evidencia; se sirven con sesión desde /uploads/…
scripts/                 migrar.ts, crear-usuario.ts
src/
├── app/                 rutas (App Router) y API
├── components/
│   ├── layout/          cascarón, barra lateral, encabezado, marca
│   ├── ui/              carta, KPI, chips, tabla, básicos
│   ├── graficas/        columnas, embudo
│   └── levantamientos/  asistente de captura de 4 pasos
├── lib/
│   ├── db.ts            pool MySQL, consulta / ejecuta / enTransaccion
│   ├── auth/            sesión JWT y usuarios
│   ├── consultas/       SQL por módulo
│   ├── costeo/          motor, tipos y pruebas
│   ├── importacion/     hoja de levantamiento en PDF: texto por coordenadas, fotos, empate con catálogos
│   │   └── excel/       Excel de costeo de 12 hojas: celdas por etiqueta, matrices persona×día, cuadre
│   ├── formato.ts       moneda, fechas, porcentajes
│   └── fechas.ts        periodos y días del proyecto
└── config/navegacion.ts
```
