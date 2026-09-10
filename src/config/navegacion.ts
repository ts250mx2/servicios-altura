import {
  Boxes, ClipboardList, Columns3, FileText, LayoutDashboard, Upload, Wallet,
  type LucideIcon,
} from "lucide-react";

export interface Enlace {
  href: string;
  texto: string;
  icono: LucideIcon;
  perfiles?: string[];
}

export const NAVEGACION: { grupo: string; enlaces: Enlace[] }[] = [
  {
    grupo: "Operación",
    enlaces: [
      { href: "/dashboard", texto: "Panel", icono: LayoutDashboard },
      { href: "/dashboard/tablero", texto: "Tablero", icono: Columns3 },
      { href: "/dashboard/levantamientos", texto: "Levantamientos", icono: ClipboardList },
      { href: "/dashboard/cotizaciones", texto: "Cotizaciones", icono: FileText },
      { href: "/dashboard/costeos", texto: "Costeos", icono: Wallet },
    ],
  },
  {
    grupo: "Administración",
    enlaces: [
      { href: "/dashboard/catalogos", texto: "Catálogos", icono: Boxes, perfiles: ["administrador", "operaciones"] },
      { href: "/dashboard/importar", texto: "Importar", icono: Upload },
    ],
  },
];

export const ETIQUETA_PERFIL: Record<string, string> = {
  administrador: "Administrador",
  ventas: "Ventas",
  operaciones: "Operaciones",
  campo: "Campo",
};
