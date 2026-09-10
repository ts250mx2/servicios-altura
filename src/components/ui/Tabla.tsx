import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Tabla({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className={cn("w-full min-w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}

export function Encabezados({ columnas }: { columnas: { texto: string; derecha?: boolean; ancho?: string }[] }) {
  return (
    <thead>
      <tr className="border-b border-borde-fuerte">
        {columnas.map((c) => (
          <th
            key={c.texto}
            style={c.ancho ? { width: c.ancho } : undefined}
            className={cn(
              "px-2 py-2 text-[0.68rem] font-semibold tracking-wider text-tinta-3 uppercase",
              c.derecha ? "text-right" : "text-left",
            )}
          >
            {c.texto}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Fila({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("border-b border-borde/60 transition-colors hover:bg-superficie-2", className)}>
      {children}
    </tr>
  );
}

export function Celda({
  children, derecha, mono, apagada, className,
}: {
  children: ReactNode; derecha?: boolean; mono?: boolean; apagada?: boolean; className?: string;
}) {
  return (
    <td className={cn(
      "px-2 py-2.5 align-middle",
      derecha && "text-right",
      mono && "num-tab",
      apagada && "text-tinta-3",
      className,
    )}>
      {children}
    </td>
  );
}
