"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";
import { Boton, Campo, Entrada } from "@/components/ui/Basicos";

function Formulario() {
  const router = useRouter();
  const parametros = useSearchParams();
  const [login, setLogin] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, clave }),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setError(datos.mensaje ?? "No se pudo entrar.");
        return;
      }
      router.push(parametros.get("regresar") || "/dashboard");
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="linea-marca w-full max-w-sm rounded-lg border border-borde bg-superficie p-7">
      <div className="mb-7 flex justify-center">
        <Image src="/logo.png" alt="Servicios de Altura" width={190} height={126} priority
          className="h-auto w-44 object-contain" />
      </div>

      <p className="etiqueta mb-5 text-center">Levantamientos · Cotización · Costeo</p>

      <div className="space-y-4">
        <Campo etiqueta="Usuario" requerido>
          <Entrada value={login} onChange={(e) => setLogin(e.target.value)}
            autoComplete="username" autoFocus required />
        </Campo>
        <Campo etiqueta="Contraseña" requerido>
          <Entrada type="password" value={clave} onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password" required />
        </Campo>
      </div>

      {error && (
        <p className="mt-4 rounded border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">
          {error}
        </p>
      )}

      <Boton tipo="submit" className="mt-6 w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Boton>
    </form>
  );
}

export default function Acceso() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-fondo p-4">
      <Suspense fallback={null}>
        <Formulario />
      </Suspense>
    </div>
  );
}
