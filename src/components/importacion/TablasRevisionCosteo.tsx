"use client";

import { Plus, Trash2 } from "lucide-react";
import { Boton, Carta, Entrada, Selector } from "@/components/ui/Basicos";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import type { Puesto } from "@/lib/consultas/catalogos";
import type { GastoRevision, InsumoRevision, PersonaRevision } from "@/lib/importacion/excel/revision";
import { ETIQUETA_CONCEPTO } from "@/lib/costeo/tipos";
import { formatoMoneda } from "@/lib/formato";

let contadorClaves = 0;

/** Clave estable para un renglón nuevo, para que React no confunda filas al insertar o borrar. */
export function nuevaClave(): string {
  contadorClaves += 1;
  return `r${Date.now()}-${contadorClaves}`;
}

/** Asigna clave a los renglones que no la traen (los que vienen del servidor). */
export function conClaves<T extends { clave?: string }>(lista: T[]): T[] {
  return lista.map((fila) => (fila.clave ? fila : { ...fila, clave: nuevaClave() }));
}

/** Copia de la lista con un renglón cambiado; nunca se muta el estado. */
function conCambio<T>(lista: T[], indice: number, cambios: Partial<T>): T[] {
  return lista.map((fila, i) => (i === indice ? { ...fila, ...cambios } : fila));
}

function sinRenglon<T>(lista: T[], indice: number): T[] {
  return lista.filter((_, i) => i !== indice);
}

const ENTRADA_TABLA = "px-2 py-1";
const NUMERO_TABLA = `${ENTRADA_TABLA} text-right num-tab`;

// ── Nómina ──────────────────────────────────────────────────────────────────

export function TablaNomina({
  filas, puestos, onChange,
}: {
  filas: PersonaRevision[];
  puestos: Puesto[];
  onChange: (filas: PersonaRevision[]) => void;
}) {
  const totalPersonas = filas.filter((p) => p.dias > 0).length;
  return (
    <Carta
      titulo="Nómina del proyecto"
      etiqueta={`${totalPersonas} personas · nómina, IMSS y desgaste en una sola matriz`}
      accion={
        <Boton variante="secundario" onClick={() =>
          onChange([...filas, {
            clave: nuevaClave(),
            nombre: "", idPuesto: puestos[0]?.IdPuesto ?? 0, dias: 1,
            salarioDiario: Number(puestos[0]?.SalarioDiario ?? 0), imssDiario: Number(puestos[0]?.ImssDiario ?? 0),
            desgasteDiario: Number(puestos[0]?.DesgasteDiario ?? 0), bono: 0,
          }])}>
          <Plus size={14} /> Persona
        </Boton>
      }
    >
      <Tabla>
        <Encabezados columnas={[
          { texto: "Persona" }, { texto: "Puesto" },
          { texto: "Días", derecha: true, ancho: "70px" }, { texto: "Salario/día", derecha: true, ancho: "110px" },
          { texto: "IMSS/día", derecha: true, ancho: "100px" }, { texto: "Desgaste/día", derecha: true, ancho: "110px" },
          { texto: "Bono", derecha: true, ancho: "100px" }, { texto: "Total", derecha: true, ancho: "110px" }, { texto: "", ancho: "40px" },
        ]} />
        <tbody>
          {filas.map((p, i) => (
            <Fila key={p.clave ?? i}>
              <Celda>
                <Entrada className={ENTRADA_TABLA} value={p.nombre} placeholder="TECNICO 1"
                  onChange={(e) => onChange(conCambio(filas, i, { nombre: e.target.value }))} />
              </Celda>
              <Celda>
                <Selector className={ENTRADA_TABLA} value={p.idPuesto}
                  onChange={(e) => onChange(conCambio(filas, i, { idPuesto: Number(e.target.value) }))}>
                  {puestos.map((x) => <option key={x.IdPuesto} value={x.IdPuesto}>{x.Abreviatura}</option>)}
                </Selector>
              </Celda>
              <NumeroCelda valor={p.dias} entero onChange={(dias) => onChange(conCambio(filas, i, { dias }))} />
              <NumeroCelda valor={p.salarioDiario} onChange={(salarioDiario) => onChange(conCambio(filas, i, { salarioDiario }))} />
              <NumeroCelda valor={p.imssDiario} onChange={(imssDiario) => onChange(conCambio(filas, i, { imssDiario }))} />
              <NumeroCelda valor={p.desgasteDiario} onChange={(desgasteDiario) => onChange(conCambio(filas, i, { desgasteDiario }))} />
              <NumeroCelda valor={p.bono} onChange={(bono) => onChange(conCambio(filas, i, { bono }))} />
              <Celda derecha mono apagada>
                {formatoMoneda((p.salarioDiario + p.imssDiario + p.desgasteDiario) * p.dias + p.bono)}
              </Celda>
              <Celda><Quitar onClick={() => onChange(sinRenglon(filas, i))} /></Celda>
            </Fila>
          ))}
        </tbody>
      </Tabla>
    </Carta>
  );
}

// ── Insumos ─────────────────────────────────────────────────────────────────

export function TablaInsumos({
  filas, onChange,
}: {
  filas: InsumoRevision[];
  onChange: (filas: InsumoRevision[]) => void;
}) {
  return (
    <Carta
      titulo="Insumos y herramental"
      etiqueta={`${filas.length} partidas · desmarca «Aplica» cuando el material lo pone el cliente`}
      accion={
        <Boton variante="secundario" onClick={() =>
          onChange([...filas, { clave: nuevaClave(), idInsumo: null, descripcion: "", unidades: 1, costo: 0, costoReal: 0, aplica: true }])}>
          <Plus size={14} /> Partida
        </Boton>
      }
    >
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta-3">Sin insumos: el material lo pone el cliente.</p>
      ) : (
        <Tabla>
          <Encabezados columnas={[
            { texto: "Concepto" }, { texto: "Unidades", derecha: true, ancho: "90px" },
            { texto: "Costo plan", derecha: true, ancho: "120px" }, { texto: "Aplica", ancho: "70px" }, { texto: "", ancho: "40px" },
          ]} />
          <tbody>
            {filas.map((x, i) => (
              <Fila key={x.clave ?? i} className={x.aplica ? undefined : "text-tinta-3"}>
                <Celda>
                  <Entrada className={ENTRADA_TABLA} value={x.descripcion}
                    onChange={(e) => onChange(conCambio(filas, i, { descripcion: e.target.value, idInsumo: null }))} />
                </Celda>
                <NumeroCelda valor={x.unidades} onChange={(unidades) => onChange(conCambio(filas, i, { unidades }))} />
                <NumeroCelda valor={x.costo} onChange={(costo) => onChange(conCambio(filas, i, { costo }))} />
                <Celda>
                  <input type="checkbox" checked={x.aplica} className="size-4 accent-[var(--color-acento)]"
                    aria-label="Aplica"
                    onChange={(e) => onChange(conCambio(filas, i, { aplica: e.target.checked }))} />
                </Celda>
                <Celda><Quitar onClick={() => onChange(sinRenglon(filas, i))} /></Celda>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}
    </Carta>
  );
}

// ── Gastos sueltos ──────────────────────────────────────────────────────────

const CONCEPTOS_GASTO = ["GASOLINA", "ADMINISTRATIVO", "EPP", "EQUIPO"] as const;

export function TablaGastos({
  filas, onChange,
}: {
  filas: GastoRevision[];
  onChange: (filas: GastoRevision[]) => void;
}) {
  return (
    <Carta
      titulo="Gastos sueltos"
      etiqueta="Gasolina, administrativos, EPP y compra de equipo"
      accion={
        <Boton variante="secundario" onClick={() =>
          onChange([...filas, { clave: nuevaClave(), concepto: "GASOLINA", fecha: null, descripcion: "", cantidad: 0 }])}>
          <Plus size={14} /> Gasto
        </Boton>
      }
    >
      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-tinta-3">Sin gastos sueltos.</p>
      ) : (
        <Tabla>
          <Encabezados columnas={[
            { texto: "Concepto", ancho: "160px" }, { texto: "Fecha", ancho: "150px" },
            { texto: "Detalle (ruta, proveedor)" }, { texto: "Importe", derecha: true, ancho: "120px" }, { texto: "", ancho: "40px" },
          ]} />
          <tbody>
            {filas.map((g, i) => (
              <Fila key={g.clave ?? i}>
                <Celda>
                  <Selector className={ENTRADA_TABLA} value={g.concepto}
                    onChange={(e) => onChange(conCambio(filas, i, { concepto: e.target.value as GastoRevision["concepto"] }))}>
                    {CONCEPTOS_GASTO.map((c) => <option key={c} value={c}>{ETIQUETA_CONCEPTO[c]}</option>)}
                  </Selector>
                </Celda>
                <Celda>
                  <Entrada type="date" className={ENTRADA_TABLA} value={g.fecha ?? ""}
                    onChange={(e) => onChange(conCambio(filas, i, { fecha: e.target.value || null }))} />
                </Celda>
                <Celda>
                  <Entrada className={ENTRADA_TABLA} value={g.descripcion}
                    onChange={(e) => onChange(conCambio(filas, i, { descripcion: e.target.value }))} />
                </Celda>
                <NumeroCelda valor={g.cantidad} onChange={(cantidad) => onChange(conCambio(filas, i, { cantidad }))} />
                <Celda><Quitar onClick={() => onChange(sinRenglon(filas, i))} /></Celda>
              </Fila>
            ))}
          </tbody>
        </Tabla>
      )}
    </Carta>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function NumeroCelda({
  valor, entero, onChange,
}: {
  valor: number; entero?: boolean; onChange: (valor: number) => void;
}) {
  return (
    <Celda derecha>
      <Entrada type="number" min={0} step={entero ? 1 : "0.01"} className={NUMERO_TABLA} value={valor}
        onChange={(e) => {
          const n = Number(e.target.value) || 0;
          onChange(entero ? Math.max(0, Math.trunc(n)) : Math.max(0, n));
        }} />
    </Celda>
  );
}

function Quitar({ onClick }: { onClick: () => void }) {
  return (
    <Boton variante="fantasma" aria-label="Quitar renglón" className="size-8 p-0" onClick={onClick}>
      <Trash2 size={14} />
    </Boton>
  );
}
