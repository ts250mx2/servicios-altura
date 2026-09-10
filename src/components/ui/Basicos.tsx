import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Carta({
  titulo, etiqueta, accion, children, className,
}: {
  titulo?: string; etiqueta?: string; accion?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-borde bg-superficie", className)}>
      {(titulo || accion) && (
        <header className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3">
          <div>
            {etiqueta && <p className="etiqueta">{etiqueta}</p>}
            {titulo && <h2 className="display text-lg text-tinta">{titulo}</h2>}
          </div>
          {accion}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Boton({
  variante = "primario", tipo = "button", className, children, ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "fantasma"; tipo?: "button" | "submit";
}) {
  const estilos = {
    primario: "bg-acento text-sobre-acento hover:bg-acento-press font-semibold",
    secundario: "border border-borde-fuerte text-tinta hover:bg-superficie-2",
    fantasma: "text-tinta-2 hover:text-tinta hover:bg-superficie-2",
  }[variante];
  return (
    <button
      type={tipo}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded px-3.5 py-2 text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        estilos, className,
      )}
      {...resto}
    >
      {children}
    </button>
  );
}

export function Campo({
  etiqueta, ayuda, requerido, className, children,
}: {
  etiqueta: string; ayuda?: string; requerido?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-tinta-2 uppercase">
        {etiqueta}
        {requerido && <span className="ml-1 text-acento">*</span>}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-tinta-3">{ayuda}</span>}
    </label>
  );
}

const CLASES_ENTRADA =
  "w-full rounded border border-borde bg-fondo px-3 py-2 text-sm text-tinta placeholder:text-tinta-3 focus:border-acento focus:outline-none";

export function Entrada({ className, ...resto }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(CLASES_ENTRADA, className)} {...resto} />;
}

export function AreaTexto({ className, ...resto }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(CLASES_ENTRADA, "min-h-20 resize-y", className)} {...resto} />;
}

export function Selector({ className, children, ...resto }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(CLASES_ENTRADA, "cursor-pointer", className)} {...resto}>
      {children}
    </select>
  );
}

export function Vacio({ mensaje, accion }: { mensaje: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-sm text-tinta-3">{mensaje}</p>
      {accion}
    </div>
  );
}
