import { describe, expect, it } from "vitest";
import type { TarjetaProyecto } from "@/lib/consultas/proyectos";
import { cambiosParaColumna, columnaDe } from "./columnas";

function tarjeta(cambios: Partial<TarjetaProyecto>): TarjetaProyecto {
  return {
    clave: "L1", cliente: "IGLESIA", proyecto: "SILICÓN", fecha: "2026-08-26", nivelRiesgo: "ALTO",
    dias: 5, personas: 6, levantamiento: { id: 1, folio: 3434, status: "BORRADOR" },
    cotizacion: null, costeo: null, ...cambios,
  };
}

describe("columnaDe", () => {
  it("coloca cada tarjeta según lo más avanzado que tiene", () => {
    expect(columnaDe(tarjeta({}))).toBe("LEVANTADO");
    expect(columnaDe(tarjeta({ levantamiento: { id: 1, folio: 1, status: "CERRADO" } }))).toBe("LISTO");
    expect(columnaDe(tarjeta({ cotizacion: { id: 2, no: 6744, status: "BORRADOR", subtotal: 1, diasAbierta: 0, vigencia: 15 } }))).toBe("COTIZANDO");
    expect(columnaDe(tarjeta({ cotizacion: { id: 2, no: 6744, status: "ENVIADA", subtotal: 1, diasAbierta: 0, vigencia: 15 } }))).toBe("ENVIADA");
    expect(columnaDe(tarjeta({
      cotizacion: { id: 2, no: 6744, status: "AUTORIZADA", subtotal: 1, diasAbierta: 0, vigencia: 15 },
      costeo: { id: 3, status: "PLANEADO", margenPlan: 50, margenReal: 0, utilidad: 1 },
    }))).toBe("AUTORIZADA");
    expect(columnaDe(tarjeta({
      cotizacion: { id: 2, no: 6744, status: "AUTORIZADA", subtotal: 1, diasAbierta: 0, vigencia: 15 },
      costeo: { id: 3, status: "EN_PROCESO", margenPlan: 50, margenReal: 0, utilidad: 1 },
    }))).toBe("EN_OBRA");
    expect(columnaDe(tarjeta({
      cotizacion: { id: 2, no: 6744, status: "AUTORIZADA", subtotal: 1, diasAbierta: 0, vigencia: 15 },
      costeo: { id: 3, status: "CERRADO", margenPlan: 50, margenReal: 48, utilidad: 1 },
    }))).toBe("TERMINADO");
    expect(columnaDe(tarjeta({ cotizacion: { id: 2, no: 6744, status: "RECHAZADA", subtotal: 1, diasAbierta: 0, vigencia: 15 } }))).toBe("PERDIDO");
    expect(columnaDe(tarjeta({ levantamiento: { id: 1, folio: 1, status: "CANCELADO" } }))).toBe("PERDIDO");
  });
});

describe("cambiosParaColumna", () => {
  const conCot = tarjeta({ cotizacion: { id: 2, no: 6744, status: "BORRADOR", subtotal: 1, diasAbierta: 0, vigencia: 15 } });
  const conCosteo = tarjeta({
    cotizacion: { id: 2, no: 6744, status: "AUTORIZADA", subtotal: 1, diasAbierta: 0, vigencia: 15 },
    costeo: { id: 3, status: "PLANEADO", margenPlan: 50, margenReal: 0, utilidad: 1 },
  });

  it("mueve un levantamiento entre borrador y listo", () => {
    expect(cambiosParaColumna(tarjeta({}), "LISTO")).toEqual({ ok: true, cambios: { levantamiento: "CERRADO" } });
    expect(cambiosParaColumna(tarjeta({}), "LEVANTADO")).toEqual({ ok: true, cambios: { levantamiento: "BORRADOR" } });
  });

  it("no deja cotizar arrastrando: hay que generar la cotización", () => {
    const r = cambiosParaColumna(tarjeta({}), "ENVIADA");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/genera la cotización/);
  });

  it("no regresa a levantado lo que ya tiene cotización", () => {
    expect(cambiosParaColumna(conCot, "LEVANTADO").ok).toBe(false);
  });

  it("mueve la cotización por sus estatus y reinicia el costeo a plan", () => {
    expect(cambiosParaColumna(conCot, "ENVIADA")).toEqual({ ok: true, cambios: { cotizacion: "ENVIADA" } });
    expect(cambiosParaColumna(conCosteo, "ENVIADA")).toEqual({ ok: true, cambios: { cotizacion: "ENVIADA", costeo: "PLANEADO" } });
  });

  it("obra y terminado exigen costeo y dejan la cotización autorizada", () => {
    expect(cambiosParaColumna(conCot, "EN_OBRA").ok).toBe(false);
    expect(cambiosParaColumna(conCosteo, "EN_OBRA")).toEqual({ ok: true, cambios: { cotizacion: "AUTORIZADA", costeo: "EN_PROCESO" } });
    expect(cambiosParaColumna(conCosteo, "TERMINADO")).toEqual({ ok: true, cambios: { cotizacion: "AUTORIZADA", costeo: "CERRADO" } });
  });

  it("perdido rechaza la cotización o cancela el levantamiento", () => {
    expect(cambiosParaColumna(conCot, "PERDIDO")).toEqual({ ok: true, cambios: { cotizacion: "RECHAZADA" } });
    expect(cambiosParaColumna(tarjeta({}), "PERDIDO")).toEqual({ ok: true, cambios: { levantamiento: "CANCELADO" } });
  });
});
