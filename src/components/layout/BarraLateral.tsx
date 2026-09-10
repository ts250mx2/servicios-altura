"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACION } from "@/config/navegacion";
import { Marca } from "./Marca";
import { cn } from "@/lib/utils";

export function BarraLateral({ perfil }: { perfil: string }) {
  const ruta = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-borde bg-superficie lg:flex">
      <div className="linea-marca flex h-20 items-center justify-center px-4">
        <Marca />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {NAVEGACION.map((grupo) => {
          const enlaces = grupo.enlaces.filter(
            (e) => !e.perfiles || e.perfiles.includes(perfil),
          );
          if (enlaces.length === 0) return null;
          return (
            <div key={grupo.grupo} className="mb-5">
              <p className="etiqueta px-2 pb-2">{grupo.grupo}</p>
              <ul className="space-y-0.5">
                {enlaces.map((e) => {
                  const activo =
                    e.href === "/dashboard" ? ruta === e.href : ruta.startsWith(e.href);
                  const Icono = e.icono;
                  return (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded px-2.5 py-2 text-sm transition-colors duration-150",
                          activo
                            ? "bg-acento font-semibold text-sobre-acento"
                            : "text-tinta-2 hover:bg-superficie-2 hover:text-tinta",
                        )}
                      >
                        <Icono size={16} strokeWidth={activo ? 2.4 : 1.8} />
                        {e.texto}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <p className="border-t border-borde px-4 py-3 text-[0.65rem] text-tinta-3">
        Servicios de Altura · v0.1
      </p>
    </aside>
  );
}
