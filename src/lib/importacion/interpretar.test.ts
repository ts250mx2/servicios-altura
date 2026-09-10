import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { interpretarLevantamiento } from "./interpretar";
import { extraerPaginas } from "./texto-pdf";
import type { Fragmento, LevantamientoExtraido, PaginaTexto } from "./tipos";

const RUTA_6744 = path.resolve(process.cwd(), "6744.pdf");
const RUTA_6745 = path.resolve(process.cwd(), "6745.pdf");
const hayPdfs = existsSync(RUTA_6744) && existsSync(RUTA_6745);

async function leerPdf(ruta: string): Promise<LevantamientoExtraido> {
  return interpretarLevantamiento(await extraerPaginas(new Uint8Array(readFileSync(ruta))));
}

function porPuesto(datos: LevantamientoExtraido, puesto: string) {
  return datos.personal.find((p) => p.puesto === puesto);
}

describe.skipIf(!hayPdfs)("levantamiento 6744 — silicón Duretán, PDF real", () => {
  let datos: LevantamientoExtraido;
  beforeAll(async () => {
    datos = await leerPdf(RUTA_6744);
  });

  it("lee el encabezado con sus celdas partidas en varios renglones", () => {
    expect(datos.noCotizacion).toBe(6744);
    expect(datos.folio).toBe(3434);
    expect(datos.fecha).toBe("2026-08-26");
    expect(datos.cliente).toBe("IGLESIA SAN JUAN DE LOS LAGOS");
    expect(datos.proyecto).toMatch(/^SERVICIO POR LIMPIEZA Y APLICACIÓN DE SILICÓN DURETAN/);
    expect(datos.proyecto).toMatch(/VENTANALES DE LA PARROQUIA$/);
    expect(datos.areaTrabajo).toBe("VENTANALES DE PORRAQUIA (EXTERIOR)");
    expect(datos.usuarioContacto).toBe("PADRE JAVIER LOZANO");
    expect(datos.responsable).toBe("JUAN GAYTAN MARTINEZ");
  });

  it("pega el correo partido a media palabra", () => {
    expect(datos.correoUsuario).toBe("F.SANJUANLAGOS.SN@ARQUIDIOCESISMTY.ORG");
  });

  it("extrae las 3 actividades completas y sus observaciones", () => {
    expect(datos.actividades).toHaveLength(3);
    expect(datos.actividades[0].descripcion).toMatch(/^EN PRIMERA INSTANCIA/);
    expect(datos.actividades[0].descripcion).toMatch(/SE ACERQUEN\.$/);
    expect(datos.actividades[1].descripcion).toMatch(/^SE PROCEDE CON LA INSTALACIÓN/);
    expect(datos.actividades[1].descripcion).toMatch(/ASCENSO Y DESCENSO$/);
    expect(datos.actividades[2].descripcion).toMatch(/EFECTIVO Y CORRECTO\.$/);
    expect(datos.actividades.every((a) => a.metros === 0)).toBe(true);
    expect(datos.observaciones).toBe(
      "LA COTIZACION SE GENERARA POR EL EXTERIOR E INTERIOR\nSOLO SE ESTARA GENERANDO COSTO POR MANO DE OBRA",
    );
  });

  it("lee el personal por columna y el nivel de riesgo que abarca tres filas", () => {
    expect(porPuesto(datos, "TÉCNICO")).toEqual({ puesto: "TÉCNICO", cantidad: 4, tiempoExtra: false, bono: true });
    expect(porPuesto(datos, "SUPERVISOR")?.cantidad).toBe(0);
    expect(porPuesto(datos, "AYUDANTE")?.cantidad).toBe(0);
    expect(porPuesto(datos, "SUP SEG")).toEqual({ puesto: "SUP SEG", cantidad: 1, tiempoExtra: false, bono: true });
    expect(porPuesto(datos, "VIGÍA")).toEqual({ puesto: "VIGÍA", cantidad: 1, tiempoExtra: false, bono: true });
    expect(datos.nivelRiesgo).toBe("ALTO");
  });

  it("extrae 6 insumos y 5 herramentales aunque el herramental esté en la página 2", () => {
    expect(datos.insumos).toHaveLength(6);
    expect(datos.insumos[0]).toEqual({ cantidad: 70, descripcion: "CARTUCHOS DE SILICON DURETAN BASE DE POLIURETANO NEGRO" });
    expect(datos.insumos[5]).toEqual({ cantidad: 2, descripcion: "PAQUETES DE REPUESTOS DE NAVAJA" });
    expect(datos.herramental).toHaveLength(5);
    expect(datos.herramental[0]).toEqual({ cantidad: 4, descripcion: "PISTOLAS CALEFATEADORAS" });
    expect(datos.herramental[4]).toEqual({ cantidad: 1, descripcion: "JABON LIQUIDO" });
  });

  it("lee días, banderas y firmas", () => {
    expect(datos.dias).toBe(5);
    expect(datos.trabajoNormal).toBe(true);
    expect(datos.trabajoExtra).toBe(false);
    expect(datos.aplicaCena).toBe(false);
    expect(datos.aplicaBono).toBe(true);
    expect(datos.elaboro).toBe("JUAN GAYTAN MARTINEZ");
    expect(datos.recibio).toBe("");
    expect(datos.reviso).toBe("");
  });

  it("no deja avisos: todo cuadró con la plantilla", () => {
    expect(datos.avisos).toEqual([]);
  });
});

describe.skipIf(!hayPdfs)("levantamiento 6745 — impermeabilizante, PDF real", () => {
  let datos: LevantamientoExtraido;
  beforeAll(async () => {
    datos = await leerPdf(RUTA_6745);
  });

  it("lee el encabezado", () => {
    expect(datos.noCotizacion).toBe(6745);
    expect(datos.folio).toBe(3435);
    expect(datos.proyecto).toBe(
      "SERVICIO POR APLICACION DE IMPERMEABILIZANTE SOBRE LAS AZOTEAS DE 3 AREAS DIFERENTES",
    );
    expect(datos.areaTrabajo).toBe("AZOTEA DE LAS AREAS REYNA DE LOS APOSTOLES, VIRGEN FIEL Y BIBLIOTECA");
  });

  it("extrae las 6 actividades sin partir la que termina un renglón en «1.10»", () => {
    expect(datos.actividades).toHaveLength(6);
    expect(datos.actividades[3].descripcion).toContain("DE POLIÉSTER DE 1.10 { M} DE ANCHO");
    expect(datos.actividades[3].descripcion).toMatch(/FLUJO DE AGUA$/);
    expect(datos.actividades[5].descripcion).toBe(
      "ADICIONAL SE ESTARA CONSIDERANDO 2 MEDIA LUNA CON UNA MEDIDA TOTAL DE 26 MTRS CUADRADOS",
    );
    expect(datos.observaciones).toBe("");
  });

  it("lee el personal sin bono", () => {
    expect(porPuesto(datos, "TÉCNICO")).toEqual({ puesto: "TÉCNICO", cantidad: 3, tiempoExtra: false, bono: false });
    expect(porPuesto(datos, "SUP SEG")?.cantidad).toBe(1);
    expect(porPuesto(datos, "VIGÍA")?.cantidad).toBe(1);
    expect(datos.nivelRiesgo).toBe("ALTO");
  });

  it("sigue la tabla de insumos en la página siguiente", () => {
    expect(datos.insumos).toHaveLength(3);
    expect(datos.insumos[2]).toEqual({
      cantidad: 30, descripcion: "CUBETAS DE 19 LITROS DE IMPERMEABILIZANTE ELASTOMERICO",
    });
    expect(datos.herramental).toEqual([
      { cantidad: 1, descripcion: "ESCALERA DE EXTENCION DE FIBRA DE VIDRIO" },
      { cantidad: 2, descripcion: "EXACTOS" },
    ]);
  });

  it("lee días, banderas en «No» y la firma", () => {
    expect(datos.dias).toBe(4);
    expect(datos.trabajoNormal).toBe(false);
    expect(datos.trabajoExtra).toBe(false);
    expect(datos.aplicaCena).toBe(false);
    expect(datos.aplicaBono).toBe(false);
    expect(datos.elaboro).toBe("JUN GAYTAN MTZ");
    expect(datos.avisos).toEqual([]);
  });
});

// ── Casos sintéticos: geometría de la plantilla sin depender de los PDF ─────

function f(x: number, y: number, texto: string): Fragmento {
  return { x, y, ancho: texto.length * 5.2, texto };
}

function pagina(fragmentos: Fragmento[], numero = 1): PaginaTexto {
  return { numero, ancho: 612, alto: 792, fragmentos };
}

describe("interpretarLevantamiento — casos sintéticos", () => {
  it("continúa cada celda del encabezado en su propia columna y acepta fecha dd/mm/aaaa", () => {
    const datos = interpretarLevantamiento([
      pagina([
        f(191, 91, "LEVANTAMIENTO DE PROYECTO"),
        f(419, 70, "NO. COTIZACIÓN: 6744"),
        f(446, 91, "FOLIO: 3434"),
        f(428, 112, "FECHA: 26/08/2026"),
        f(47, 142, "PROYECTO: UNO"), f(47, 152, "DOS"),
        f(212, 142, "ÁREA DE TRABAJO: AZOTEA"),
        f(406, 147, "CLIENTE: IGLESIA"), f(406, 157, "LAGOS"),
        f(47, 191, "USUARIO: PADRE"),
        f(212, 181, "CORREO USUARIO:"), f(212, 191, "A@B.OR"), f(212, 202, "G"),
        f(406, 191, "RESPONSABLE: JUAN"),
        f(257, 221, "TRABAJO A REALIZAR"),
      ]),
    ]);
    expect(datos.noCotizacion).toBe(6744);
    expect(datos.folio).toBe(3434);
    expect(datos.fecha).toBe("2026-08-26");
    expect(datos.proyecto).toBe("UNO DOS");
    expect(datos.areaTrabajo).toBe("AZOTEA");
    expect(datos.cliente).toBe("IGLESIA LAGOS");
    expect(datos.usuarioContacto).toBe("PADRE");
    expect(datos.correoUsuario).toBe("A@B.ORG");
    expect(datos.responsable).toBe("JUAN");
  });

  it("reparte los renglones por el centro de la celda de metros, no por dónde acaba el texto", () => {
    const datos = interpretarLevantamiento([
      pagina([
        f(257, 100, "TRABAJO A REALIZAR"),
        f(47, 120, "DESCRIPCIÓN"), f(497, 120, "METROS"),
        f(47, 140, "MALLA DE 1.10"), f(47, 151, "M DE ANCHO"), f(514, 145.5, "0"),
        f(47, 170, "SEGUNDA ACTIVIDAD"), f(514, 170, "26.5"),
        f(235, 190, "OBSERVACIONES DEL TRABAJO"),
        f(248, 210, "CANTIDAD DE PERSONAL"),
      ]),
    ]);
    expect(datos.actividades).toEqual([
      { descripcion: "MALLA DE 1.10 M DE ANCHO", metros: 0 },
      { descripcion: "SEGUNDA ACTIVIDAD", metros: 26.5 },
    ]);
  });

  it("pega la descripción de un insumo partida en dos renglones", () => {
    const datos = interpretarLevantamiento([
      pagina([
        f(284, 100, "INSUMOS"),
        f(72, 120, "CANTIDAD"), f(152, 120, "DESCRIPCIÓN"),
        f(93, 140, "3"), f(152, 140, "CUBETAS DE 19 LITROS DE"),
        f(152, 151, "SELLADOR"),
        f(93, 170, "2"), f(152, 170, "BROCHAS"),
        f(271, 190, "HERRAMENTAL"),
      ]),
    ]);
    expect(datos.insumos).toEqual([
      { cantidad: 3, descripcion: "CUBETAS DE 19 LITROS DE SELLADOR" },
      { cantidad: 2, descripcion: "BROCHAS" },
    ]);
  });

  it("avisa de todo lo que falta cuando el PDF no trae la plantilla", () => {
    const datos = interpretarLevantamiento([pagina([f(191, 91, "CUALQUIER OTRO DOCUMENTO")])]);
    expect(datos.folio).toBeNull();
    expect(datos.actividades).toEqual([]);
    expect(datos.avisos).toEqual(expect.arrayContaining([
      "No se encontró la sección «TRABAJO A REALIZAR».",
      "No se encontró el folio.",
      "No se encontró el cliente.",
      "No se encontró personal asignado.",
    ]));
  });

  it("marca como escaneo un PDF sin texto", () => {
    const datos = interpretarLevantamiento([pagina([])]);
    expect(datos.avisos).toEqual(["El PDF no tiene texto legible; puede ser un escaneo."]);
  });
});
