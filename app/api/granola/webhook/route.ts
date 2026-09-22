import { verificarFirmaGranola } from "@/lib/consultoria/granola-nota";
import {
  parseWebhookGranola,
  sincronizarNotaGranola,
} from "@/lib/consultoria/granola-sync";

export async function POST(request: Request) {
  const body = await request.text();
  const firmaOk = verificarFirmaGranola({
    body,
    firma: request.headers.get("webhook-signature"),
    id: request.headers.get("webhook-id"),
    secreto: process.env.GRANOLA_WEBHOOK_SECRET ?? "",
    timestamp: request.headers.get("webhook-timestamp"),
  });

  if (!firmaOk) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const parsed = parseWebhookGranola(body);
  if (!parsed.success) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const resultado = await sincronizarNotaGranola(parsed.data.note_id);
  if (resultado === "error") {
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}
