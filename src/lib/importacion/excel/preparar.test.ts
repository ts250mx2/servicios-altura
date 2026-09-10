import { describe, expect, it } from "vitest";
import type { Cliente, Insumo, Puesto } from "@/lib/consultas/catalogos";
import { costeoVacio } from "./interpretar";
import { buscarVendedor, prepararCosteo, puestoDePersona } from "./preparar";
import type { CosteoExtraido } from "./tipos";

const PUESTOS: Puesto[] = [
  { IdPuesto: 1, Puesto: "TÉCNICO EN ALTURA", Abreviatura: "TÉCNICO", SalarioDiario: 700, ImssDiario: 51.3, DesgasteDiario: 100, BonoDefault: 800, TarifaVentaDia: 4200, Orden: 1 },
  { IdPuesto: 2, Puesto: "SUPERVISOR", Abreviatura: "SUPERV.", SalarioDiario: 900, ImssDiario: 51.3, DesgasteDiario: 100, BonoDefault: 800, TarifaVentaDia: 4800, Orden: 2 },
  { IdPuesto: 3, Puesto: "AYUDANTE", Abreviatura: "AYUD.", SalarioDiario: 500, ImssDiario: 51.3, DesgasteDiario: 0, BonoDefault: 0, TarifaVentaDia: 2500, Orden: 3 },
  { IdPuesto: 4, Puesto: "SUPERVISOR DE SEGURIDAD", Abreviatura: "SUP SEG", SalarioDiario: 800, ImssDiario: 51.3, DesgasteDiario: 100, BonoDefault: 800, TarifaVentaDia: 4200, Orden: 4 },
  { IdPuesto: 5, Puesto: "VIGÍA", Abreviatura: "VIGÍA", SalarioDiario: 600, ImssDiario: 51.3, DesgasteDiario: 0, BonoDefault: 800, TarifaVentaDia: 3000, Orden: 5 },
];
const CLIENTES: Cliente[] = [
  { IdCliente: 7, Cliente: "Iglesia San Juan de los Lagos", Planta: null, Contacto: null, Correo: null, Telefono: null, Ciudad: null },
];
const INSUMOS: Insumo[] = [
  { IdInsumo: 9, Insumo: "Exactos", Unidad: "PZA", CostoUnitario: 30, EsHerramental: 1 },
];
const VENDEDORES = [{ IdUsuario: 1, Usuario: "Juan Gaytán Martínez" }, { IdUsuario: 2, Usuario: "Rodolfo Pérez" }];
const CATALOGOS = { clientes: CLIENTES, puestos: PUESTOS, insumos: INSUMOS, vendedores: VENDEDORES };

function extraido(cambios: Partial<CosteoExtraido>): CosteoExtraido {
  return { ...costeoVacio([]), ...cambios };
}

describe("puestoDePersona", () => {
  it("quita el número de plaza y empata con el catálogo", () => {
    expect(puestoDePersona("TECNICO 3", PUESTOS)?.IdPuesto).toBe(1);
    expect(puestoDePersona("SUP. SEGURIDAD", PUESTOS)?.IdPuesto).toBe(4);
    expect(puestoDePersona("SUP SEG 1", PUESTOS)?.IdPuesto).toBe(4);
    expect(puestoDePersona("VIGIA", PUESTOS)?.IdPuesto).toBe(5);
    expect(puestoDePersona("SUPERVISOR 2", PUESTOS)?.IdPuesto).toBe(2);
    expect(puestoDePersona("AYUD 1", PUESTOS)?.IdPuesto).toBe(3);
  });

  it("no empata un nombre propio", () => {
    expect(puestoDePersona("MARCOS TOVAR", PUESTOS)).toBeUndefined();
  });
});

describe("buscarVendedor", () => {
  it("empata por nombre parcial sin acentos", () => {
    expect(buscarVendedor("JUAN GAYTAN", VENDEDORES)?.IdUsuario).toBe(1);
    expect(buscarVendedor("Rodolfo Pérez", VENDEDORES)?.IdUsuario).toBe(2);
    expect(buscarVendedor("PEDRO", VENDEDORES)).toBeUndefined();
  });
});

describe("prepararCosteo", () => {
  const base = extraido({
    noCotizacion: 6744, folio: 3434, planta: "IGLESIA SAN JUAN DE LOS LAGOS", usuario: "JAVIER LOZANO",
    vendedor: "JUAN GAYTAN", fecha: "2026-08-26", dias: 5, personal: 2, precioVenta: 130800,
    autoriza: "AUTORIZA RODOLFO",
    nomina: [
      { nombre: "TECNICO 1", dias: 5, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 100, bono: 800 },
      { nombre: "MARCOS TOVAR", dias: 5, salarioDiario: 700, imssDiario: 51.3, desgasteDiario: 0, bono: 0 },
    ],
    insumos: [
      { descripcion: "EXACTOS", unidades: 5, costoPlan: 150, costoReal: 150, fecha: null, comentario: "", aplica: true },
      { descripcion: "SELLADOR", unidades: 3, costoPlan: 0, costoReal: 0, fecha: null, comentario: "NO APLICAR", aplica: false },
    ],
  });

  it("liga al levantamiento del folio cuando existe y no tiene cotización", () => {
    const { inicial, avisos } = prepararCosteo(base, CATALOGOS, {
      idLevantamiento: 12, folio: 3434, proyecto: "X", cliente: "IGLESIA SAN JUAN DE LOS LAGOS", noCotizacion: null,
    });
    expect(inicial.idLevantamiento).toBe(12);
    expect(inicial.idCliente).toBe(7);
    expect(inicial.statusCotizacion).toBe("AUTORIZADA");
    expect(inicial.autorizadoPor).toBe("AUTORIZA RODOLFO");
    expect(inicial.idVendedor).toBe(1);
    expect(avisos).toEqual(["No se reconoció el puesto de «MARCOS TOVAR»; se asumió TÉCNICO EN ALTURA."]);
  });

  it("no liga cuando el folio ya tiene cotización, y avisa", () => {
    const { inicial, avisos } = prepararCosteo(base, CATALOGOS, {
      idLevantamiento: 12, folio: 3434, proyecto: "X", cliente: "IGLESIA SAN JUAN DE LOS LAGOS", noCotizacion: 6700,
    });
    expect(inicial.idLevantamiento).toBeNull();
    expect(inicial.idCliente).toBe(7);
    expect(avisos).toContain("El folio 3434 ya tiene la cotización 6700; esta se guardará sin ligar al levantamiento.");
  });

  it("sin levantamiento, empata el cliente por nombre o lo deja como nuevo", () => {
    const { inicial, avisos } = prepararCosteo({ ...base, planta: "PARROQUIA NUEVA" }, CATALOGOS, null);
    expect(inicial.idLevantamiento).toBeNull();
    expect(inicial.idCliente).toBe("nuevo");
    expect(inicial.clienteNuevo).toBe("PARROQUIA NUEVA");
    expect(inicial.contacto).toBe("JAVIER LOZANO");
    expect(avisos).toContain("No hay levantamiento con folio 3434; la cotización se guardará sin ligar. Puedes importar su PDF después.");
    expect(avisos).toContain("El cliente «PARROQUIA NUEVA» no está en el catálogo; se dará de alta al guardar.");
  });

  it("asigna puesto a cada persona y empata insumos por nombre", () => {
    const { inicial } = prepararCosteo(base, CATALOGOS, null);
    expect(inicial.nomina[0]).toMatchObject({ nombre: "TECNICO 1", idPuesto: 1, dias: 5, bono: 800 });
    expect(inicial.nomina[1]).toMatchObject({ nombre: "MARCOS TOVAR", idPuesto: 1 });
    expect(inicial.insumos[0]).toMatchObject({ idInsumo: 9, costo: 150, aplica: true });
    expect(inicial.insumos[1]).toMatchObject({ idInsumo: null, costo: 0, aplica: false });
  });

  it("sólo conserva el gasto real cuando difiere del plan", () => {
    const sinReal = prepararCosteo(base, CATALOGOS, null);
    expect(sinReal.inicial.conceptosReal).toBeNull();
    const conReal = prepararCosteo(
      { ...base, conceptosPlan: { ...base.conceptosPlan, GASOLINA: 1500 }, conceptosReal: { ...base.conceptosReal, GASOLINA: 1800 } },
      CATALOGOS, null,
    );
    expect(conReal.inicial.conceptosReal?.GASOLINA).toBe(1800);
  });

  it("rellena con valores seguros lo que el Excel no trajo", () => {
    const { inicial, referencia } = prepararCosteo(
      extraido({ fecha: null, dias: null, nomina: [{ nombre: "TECNICO 1", dias: 3, salarioDiario: 700, imssDiario: 0, desgasteDiario: 0, bono: 0 }], gastoTotalExcel: 10, utilidadNetaExcel: 5 }),
      CATALOGOS, null,
    );
    expect(inicial.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(inicial.dias).toBe(3);
    expect(inicial.statusCotizacion).toBe("ENVIADA");
    expect(inicial.noCotizacion).toBe(0);
    expect(referencia).toEqual({ gastoTotal: 10, utilidadNeta: 5 });
  });
});
