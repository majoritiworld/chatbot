/** Local HTTP stand-in for Supabase, never imported by product code.
 * Exercises the real SDK, cookie handling, actions, proxy and callback.
 * It does NOT emulate RLS or validate actual Supabase credentials.
 */
import { createServer, type ServerResponse } from "node:http";

const id = "10000000-0000-4000-8000-000000000001";
const stakeholderId = "20000000-0000-4000-8000-000000000001";
const projectId = "30000000-0000-4000-8000-000000000001";
const oldId = "40000000-0000-4000-8000-000000000001";
const newId = "40000000-0000-4000-8000-000000000002";
const email = "participant@example.test";
const user = {
  app_metadata: { provider: "email", providers: ["email"] },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
  email,
  email_confirmed_at: "2026-01-01T00:00:00Z",
  id,
  role: "authenticated",
  user_metadata: {},
};
const profile = {
  email,
  id,
  nombre: "Test",
  proyecto_id: projectId,
  rol: "stakeholder",
};
const stakeholder = {
  apellido: null,
  email,
  id: stakeholderId,
  nombre: "Test",
  proyecto_id: projectId,
};
let events: { path: string; redirectTo: string | null }[] = [];

function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(data));
}

function session() {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ aud: "authenticated", email, exp, role: "authenticated", sub: id })}.test-signature`,
    expires_at: exp,
    expires_in: 3600,
    refresh_token: "synthetic-refresh-token",
    token_type: "bearer",
    user,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:54431");
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString();
  const body = raw ? JSON.parse(raw) : {};
  const path = url.pathname;
  if (path === "/health") {
    return json(response, 200, { ok: true });
  }
  if (path === "/test/events") {
    if (request.method === "DELETE") {
      events = [];
    }
    return json(response, 200, events);
  }
  if (path === "/auth/v1/otp") {
    events.push({ path, redirectTo: url.searchParams.get("redirect_to") });
    return json(response, 200, {});
  }
  if (path === "/auth/v1/verify") {
    events.push({ path, redirectTo: null });
    if (
      body.token === "12345678" ||
      body.token_hash === "valid-synthetic-token"
    ) {
      return json(response, 200, session());
    }
    return json(response, 403, {
      code: "otp_expired",
      message: "Expired synthetic code",
    });
  }
  if (path === "/auth/v1/user") {
    return json(response, 200, user);
  }
  if (path === "/auth/v1/admin/users" && request.method === "POST") {
    return json(response, 422, {
      code: "email_exists",
      message: "User already registered",
    });
  }
  if (path === `/auth/v1/admin/users/${id}`) {
    return json(response, 200, { user });
  }
  if (path.startsWith("/rest/v1/")) {
    let rows: unknown[] = [];
    if (path === "/rest/v1/usuario") {
      rows = [profile];
    }
    if (path === "/rest/v1/stakeholder") {
      rows = [stakeholder];
    }
    if (path === "/rest/v1/entrevista") {
      const queriedId = url.searchParams.get("id")?.replace(/^eq\./, "");
      if (!queriedId) {
        rows = [
          {
            estado: "abierta",
            flujo_estado: "chat",
            id: oldId,
            ultima_actividad: "2026-09-21",
          },
        ];
      } else if ([oldId, newId].includes(queriedId)) {
        rows = [
          {
            consentimiento_en: null,
            correo_agradecimiento_en: null,
            estado: "abierta",
            fecha_completada: null,
            flujo_estado: "bienvenida",
            id: queriedId,
            preguntas: [],
            seccion_actual: 0,
            secciones: [
              {
                id: "tema-1",
                preguntas: ["Pregunta sintética"],
                titulo: "Tema de prueba",
              },
            ],
            secciones_completadas: [],
            stakeholder,
            stakeholder_id: stakeholderId,
            transcripcion: [],
          },
        ];
      }
    }
    const single = request.headers.accept?.includes(
      "application/vnd.pgrst.object+json"
    );
    return json(response, 200, single ? (rows[0] ?? null) : rows);
  }
  return json(response, 404, { error: "Unsupported local test endpoint" });
});

server.listen(54_431, "127.0.0.1");
process.on("SIGTERM", () => server.close());
process.on("SIGINT", () => server.close());
