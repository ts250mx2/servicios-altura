"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { ETIQUETA_PERFIL } from "@/config/navegacion";
import { Boton } from "@/components/ui/Basicos";

export function Encabezado({ usuario, perfil }: { usuario: string; perfil: string }) {
  const router = useRouter();

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-borde bg-superficie px-4 lg:px-6">
      <div className="lg:hidden">
        <span className="display text-sm whitespace-nowrap text-acento">Servicios de Altura</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-tight text-tinta">{usuario}</p>
          <p className="text-[0.7rem] text-tinta-3">{ETIQUETA_PERFIL[perfil] ?? perfil}</p>
        </div>

        <Boton variante="fantasma" onClick={salir} aria-label="Cerrar sesión">
          <LogOut size={16} />
        </Boton>
      </div>
    </header>
  );
}
