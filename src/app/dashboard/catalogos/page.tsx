import { TituloPagina } from "@/components/layout/Cascaron";
import { Carta, Vacio } from "@/components/ui/Basicos";
import { Celda, Encabezados, Fila, Tabla } from "@/components/ui/Tabla";
import { clientes, empleados, insumos, parametros, puestos } from "@/lib/consultas/catalogos";
import { formatoMoneda, formatoNumero } from "@/lib/formato";

export const dynamic = "force-dynamic";

const DESCRIPCION_PARAMETRO: Record<string, string> = {
  IMPUESTOS_PCT: "Impuestos sobre el gasto directo",
  ADMINISTRATIVOS_PCT: "Administrativos (5 / 10 / 15 %)",
  FINANCIAMIENTO_PCT: "Financiamiento sobre el subtotal con insumos",
  COMISION_PCT: "Comisión del vendedor sobre la utilidad bruta",
  ISR_FIJO: "ISR fijo por proyecto",
  IVA_PCT: "IVA",
  MARGEN_OBJETIVO_PCT: "Margen objetivo del precio sugerido",
  MARGEN_ALERTA_PCT: "Debajo de este margen el semáforo se pone en rojo",
};

export default async function Catalogos() {
  const [listaPuestos, listaClientes, listaInsumos, listaEmpleados, config] = await Promise.all([
    puestos(), clientes(), insumos(), empleados(), parametros(),
  ]);

  return (
    <>
      <TituloPagina
        titulo="Catálogos"
        descripcion="Las tarifas de aquí alimentan todos los costeos. Cambiar un renglón cambia los proyectos nuevos, no los ya guardados."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Carta titulo="Puestos y tarifas" etiqueta="La fuente de verdad del costeo">
          <Tabla>
            <Encabezados columnas={[
              { texto: "Puesto" },
              { texto: "Nómina/día", derecha: true },
              { texto: "IMSS/día", derecha: true },
              { texto: "Desgaste", derecha: true },
              { texto: "Bono", derecha: true },
              { texto: "Venta/día", derecha: true },
            ]} />
            <tbody>
              {listaPuestos.map((p) => (
                <Fila key={p.IdPuesto}>
                  <Celda>{p.Puesto}</Celda>
                  <Celda derecha mono>{formatoMoneda(p.SalarioDiario)}</Celda>
                  <Celda derecha mono apagada>{formatoMoneda(p.ImssDiario)}</Celda>
                  <Celda derecha mono apagada>{formatoMoneda(p.DesgasteDiario)}</Celda>
                  <Celda derecha mono apagada>{formatoMoneda(p.BonoDefault)}</Celda>
                  <Celda derecha mono className="text-acento">{formatoMoneda(p.TarifaVentaDia)}</Celda>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </Carta>

        <Carta titulo="Parámetros del costeo" etiqueta="Porcentajes de la cadena">
          <Tabla>
            <Encabezados columnas={[
              { texto: "Clave" },
              { texto: "Qué controla" },
              { texto: "Valor", derecha: true },
            ]} />
            <tbody>
              {Object.entries(config).map(([clave, valor]) => (
                <Fila key={clave}>
                  <Celda mono>{clave}</Celda>
                  <Celda apagada>{DESCRIPCION_PARAMETRO[clave] ?? "—"}</Celda>
                  <Celda derecha mono>
                    {clave.endsWith("_PCT") ? `${formatoNumero(valor, 2)} %` : formatoMoneda(valor)}
                  </Celda>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </Carta>

        <Carta titulo="Clientes" etiqueta={`${listaClientes.length} registrados`}>
          {listaClientes.length === 0 ? (
            <Vacio mensaje="Sin clientes. Se dan de alta desde el levantamiento." />
          ) : (
            <Tabla>
              <Encabezados columnas={[{ texto: "Cliente" }, { texto: "Contacto" }, { texto: "Ciudad" }]} />
              <tbody>
                {listaClientes.map((c) => (
                  <Fila key={c.IdCliente}>
                    <Celda>
                      {c.Cliente}
                      {c.Planta && <span className="ml-2 text-xs text-tinta-3">{c.Planta}</span>}
                    </Celda>
                    <Celda apagada>{c.Contacto ?? "—"}</Celda>
                    <Celda apagada>{c.Ciudad ?? "—"}</Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Carta>

        <Carta titulo="Insumos" etiqueta={`${listaInsumos.length} en catálogo`}>
          {listaInsumos.length === 0 ? (
            <Vacio mensaje="Sin insumos en catálogo. Se pueden capturar libres en el levantamiento." />
          ) : (
            <Tabla>
              <Encabezados columnas={[
                { texto: "Insumo" },
                { texto: "Unidad" },
                { texto: "Costo", derecha: true },
              ]} />
              <tbody>
                {listaInsumos.map((i) => (
                  <Fila key={i.IdInsumo}>
                    <Celda>
                      {i.Insumo}
                      {i.EsHerramental === 1 && (
                        <span className="ml-2 text-xs text-tinta-3">herramental</span>
                      )}
                    </Celda>
                    <Celda apagada>{i.Unidad}</Celda>
                    <Celda derecha mono>{formatoMoneda(i.CostoUnitario)}</Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          )}
        </Carta>

        {listaEmpleados.length > 0 && (
          <Carta titulo="Empleados" etiqueta={`${listaEmpleados.length} activos`} className="lg:col-span-2">
            <Tabla>
              <Encabezados columnas={[
                { texto: "Empleado" },
                { texto: "Puesto" },
                { texto: "Nómina/día", derecha: true },
                { texto: "IMSS/día", derecha: true },
                { texto: "Desgaste", derecha: true },
              ]} />
              <tbody>
                {listaEmpleados.map((e) => (
                  <Fila key={e.IdEmpleado}>
                    <Celda>{e.Empleado}</Celda>
                    <Celda apagada>{e.Puesto}</Celda>
                    <Celda derecha mono>{formatoMoneda(e.SalarioDiario)}</Celda>
                    <Celda derecha mono apagada>{formatoMoneda(e.ImssDiario)}</Celda>
                    <Celda derecha mono apagada>{formatoMoneda(e.DesgasteDiario)}</Celda>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </Carta>
        )}
      </div>
    </>
  );
}
