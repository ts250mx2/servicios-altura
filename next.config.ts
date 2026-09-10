import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  // pdf.js (vía unpdf) se carga con el require nativo de Node, no empaquetado.
  serverExternalPackages: ["unpdf", "exceljs", "jspdf", "jspdf-autotable"],
  experimental: {
    // Con proxy.ts, Next clona el cuerpo de cada petición y lo corta a 10 MB por
    // defecto; las hojas de levantamiento con fotos pesan más (6744.pdf: 15 MB).
    proxyClientMaxBodySize: "40mb",
  },
};

export default nextConfig;
