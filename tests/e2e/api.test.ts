import { expect, test } from "@playwright/test";

for (const path of [
  "/api/chat",
  "/api/entrevista/flujo",
  "/api/entrevista/guardar",
  "/api/entrevista/finalizar",
  "/api/entrevista/enviar",
]) {
  test(`anonymous requests to ${path} cannot perform interview operations`, async ({
    request,
  }) => {
    const response = await request.post(path, { data: {}, maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe(
      "/login"
    );
  });
}
