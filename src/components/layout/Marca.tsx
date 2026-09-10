import Image from "next/image";
import Link from "next/link";

/** El sello oficial. No redibujar el logo a mano: siempre este archivo. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-3" aria-label="Servicios de Altura">
      <Image
        src="/logo.png"
        alt="Servicios de Altura"
        width={compacta ? 38 : 150}
        height={compacta ? 26 : 100}
        priority
        className="h-auto w-auto object-contain"
        style={{ maxHeight: compacta ? 30 : 62 }}
      />
      <span className="sr-only">Servicios de Altura</span>
    </Link>
  );
}
