import type { ReactNode } from "react";
import { BarraLateral } from "./BarraLateral";
import { Encabezado } from "./Encabezado";
import type { Sesion } from "@/lib/auth/sesion";

export function Cascaron({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  return (
    <div className="flex h-dvh overflow-hidden bg-fondo">
      <BarraLateral perfil={sesion.perfil} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Encabezado usuario={sesion.usuario} perfil={sesion.perfil} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export function TituloPagina({
  titulo, descripcion, accion,
}: {
  titulo: string; descripcion?: string; accion?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="display text-2xl text-tinta">{titulo}</h1>
        {descripcion && <p className="mt-1 text-sm text-tinta-2">{descripcion}</p>}
      </div>
      {accion}
    </div>
  );
}
