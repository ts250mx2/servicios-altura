import { redirect } from "next/navigation";
import { Cascaron } from "@/components/layout/Cascaron";
import { leerSesion } from "@/lib/auth/sesion";

export const dynamic = "force-dynamic";

export default async function LayoutTablero({ children }: { children: React.ReactNode }) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");
  return <Cascaron sesion={sesion}>{children}</Cascaron>;
}
