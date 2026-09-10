import { getDocumentProxy } from "unpdf";
import { ErrorDeImportacion } from "./errores";
import type { Fragmento, PaginaTexto } from "./tipos";

/** Una hoja de levantamiento tiene dos páginas de texto más las fotos. */
export const MAX_PAGINAS = 40;

/**
 * Texto de cada página con coordenadas (origen arriba-izquierda).
 * mPDF emite un fragmento por renglón de celda, así que con la posición basta
 * para saber en qué columna cae cada cosa sin adivinar por el orden del texto.
 */
export async function extraerPaginas(bytes: Uint8Array): Promise<PaginaTexto[]> {
  // pdf.js puede quedarse con el buffer; se le da una copia para poder reusar `bytes`.
  const documento = await getDocumentProxy(new Uint8Array(bytes));
  try {
    if (documento.numPages > MAX_PAGINAS) {
      throw new ErrorDeImportacion(
        `El PDF tiene ${documento.numPages} páginas; una hoja de levantamiento tiene menos de ${MAX_PAGINAS}.`,
      );
    }
    const paginas: PaginaTexto[] = [];
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const vista = pagina.getViewport({ scale: 1 });
      const contenido = await pagina.getTextContent();
      const fragmentos = contenido.items.flatMap((item): Fragmento[] => {
        if (!("str" in item) || item.str.trim() === "") return [];
        const [, , , , x, y] = item.transform;
        return [{ x, y: vista.height - y, ancho: item.width, texto: item.str.trim() }];
      });
      paginas.push({ numero, ancho: vista.width, alto: vista.height, fragmentos });
    }
    return paginas;
  } finally {
    await documento.loadingTask.destroy();
  }
}
