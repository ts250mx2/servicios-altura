"use client";

import { useState } from "react";
import { Entrada } from "@/components/ui/Basicos";
import { cn } from "@/lib/utils";

const SOLO_NUMERO = /^\d*\.?\d*$/;

function aTexto(valor: number): string {
  return valor === 0 ? "" : String(valor);
}

/**
 * Cifra capturada como texto: sin flechas de subir/bajar, sin que la rueda del ratón
 * la mueva y sin un 0 estorbando; el campo vacío vale 0.
 */
export function EntradaNumero({
  valor, alCambiar, className, ...resto
}: {
  valor: number;
  alCambiar: (valor: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [texto, setTexto] = useState(aTexto(valor));
  const [previo, setPrevio] = useState(valor);

  // El valor cambió desde fuera (p. ej. el costo al mover la cantidad): se refleja,
  // salvo que sea lo mismo que ya está escrito ("12." sigue siendo 12).
  if (valor !== previo) {
    setPrevio(valor);
    if (Number(texto) !== valor) setTexto(aTexto(valor));
  }

  return (
    <Entrada
      {...resto}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={cn("num-tab", className)}
      value={texto}
      onChange={(e) => {
        const nuevo = e.target.value.replace(",", ".");
        if (!SOLO_NUMERO.test(nuevo)) return;
        setTexto(nuevo);
        alCambiar(Number(nuevo) || 0);
      }}
    />
  );
}
