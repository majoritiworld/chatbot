import { createHmac, timingSafeEqual } from "node:crypto";

const SESGO_SEGUNDOS = 5 * 60;
const PREFIJO_SECRETO = "whsec_";

export type NotaGranola = {
  summary_markdown: string | null;
  summary_text: string;
};

export function minutaParaPortal(nota: NotaGranola) {
  const markdown = nota.summary_markdown?.trim();
  if (markdown) {
    return markdown;
  }

  const texto = nota.summary_text.trim();
  if (!texto) {
    return null;
  }
  return texto;
}

export function debeReemplazarMinuta(
  evento: { granolaNoteId: string | null; minuta: string | null },
  noteId: string
) {
  if (!evento.minuta?.trim()) {
    return true;
  }
  return evento.granolaNoteId === noteId;
}

function claveWebhook(secreto: string) {
  const codificada = secreto.startsWith(PREFIJO_SECRETO)
    ? secreto.slice(PREFIJO_SECRETO.length)
    : secreto;
  return Buffer.from(codificada, "base64");
}

export function verificarFirmaGranola(input: {
  ahoraSegundos?: number;
  body: string;
  firma: string | null;
  id: string | null;
  secreto: string;
  timestamp: string | null;
}) {
  if (!(input.id && input.timestamp && input.firma && input.secreto)) {
    return false;
  }

  const marca = Number(input.timestamp);
  const ahora = input.ahoraSegundos ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(marca) || Math.abs(ahora - marca) > SESGO_SEGUNDOS) {
    return false;
  }

  const firmado = `${input.id}.${input.timestamp}.${input.body}`;
  const esperada = createHmac("sha256", claveWebhook(input.secreto))
    .update(firmado, "utf8")
    .digest("base64");
  const esperadaBuffer = Buffer.from(esperada);

  return input.firma.split(" ").some((versionada) => {
    const [version, firma = ""] = versionada.split(",");
    const recibida = Buffer.from(firma);
    return (
      version === "v1" &&
      recibida.length === esperadaBuffer.length &&
      timingSafeEqual(recibida, esperadaBuffer)
    );
  });
}
