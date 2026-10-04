import { expect, test } from "@playwright/test";
import { modeloPruebaLocalEtm } from "@/lib/consultoria/modelos-entrevista";

test("la comparación de modelo solo admite entrevistas ficticias locales enumeradas", () => {
  const previo = { ...process.env };
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3110";
    process.env.ETM_MODELO_PRUEBA = "openai/gpt-6-sol";
    process.env.ETM_ENTREVISTAS_PRUEBA = "ficticia";
    const caso = {
      entrevistaId: "ficticia",
      email: "prueba@example.test",
      recorridoBreve: true,
    };
    expect(modeloPruebaLocalEtm(caso)).toBe("openai/gpt-6-sol");
    expect(
      modeloPruebaLocalEtm({ ...caso, email: "persona@cliente.cl" })
    ).toBeUndefined();
    expect(
      modeloPruebaLocalEtm({ ...caso, entrevistaId: "otra" })
    ).toBeUndefined();
    expect(
      modeloPruebaLocalEtm({ ...caso, recorridoBreve: false })
    ).toBeUndefined();
    process.env.NEXT_PUBLIC_SITE_URL = "https://portal.majoriti.world";
    expect(modeloPruebaLocalEtm(caso)).toBeUndefined();
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3110";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://remota.supabase.co";
    expect(modeloPruebaLocalEtm(caso)).toBeUndefined();
  } finally {
    for (const key of [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SITE_URL",
      "ETM_MODELO_PRUEBA",
      "ETM_ENTREVISTAS_PRUEBA",
    ]) {
      if (previo[key] === undefined) delete process.env[key];
      else process.env[key] = previo[key];
    }
  }
});
