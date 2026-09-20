import { expect, test } from "@playwright/test";

const base = "/vista-previa-entrevista?cabecera=1";
const tituloLargo =
  "Cómo se deciden altas, bajas y renovaciones en membresías comerciales";
const correoLargo =
  "participante.con.apellido.muy.largo@compliancelatam.example";

async function abrirCabecera(
  page: import("@playwright/test").Page,
  query = ""
) {
  await page.goto(`${base}${query}`);
  await expect(page.getByTestId("entrevista-cabecera")).toBeVisible();
  await expect(page.getByTestId("entrevista-cabecera")).not.toBeEmpty();
}

test.describe("Interview mobile header", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("keeps a compact two-line header and moves account into the menu", async ({
    page,
  }) => {
    await abrirCabecera(
      page,
      `&rol=cliente&email=${encodeURIComponent(correoLargo)}&titulo=${encodeURIComponent(tituloLargo)}`
    );

    const cabecera = page.getByTestId("entrevista-cabecera");
    await expect(
      cabecera.getByText("Tema 1 de 4", { exact: true })
    ).toBeVisible();
    await expect(
      cabecera.getByRole("heading", { name: tituloLargo })
    ).toBeVisible();
    await expect(cabecera.getByText("Entrevista /")).toHaveCount(0);
    const guardar = page
      .getByRole("button", { name: "Guardar" })
      .filter({ visible: true });
    await expect(guardar).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Cerrar sesión" })
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Más opciones" }).click();
    await expect(page.getByText(correoLargo)).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Cómo funciona" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Cerrar sesión" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Volver al portal" })
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Cómo funciona" }).click();
    await expect(
      page.getByRole("link", { name: "Escríbenos por WhatsApp" })
    ).toHaveAttribute("href", "https://wa.me/972587623357");
  });

  test("does not offer the portal to a stakeholder", async ({ page }) => {
    await abrirCabecera(page, "&rol=stakeholder&temas=1");
    await page.getByRole("button", { name: "Más opciones" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Volver al portal" })
    ).toHaveCount(0);
    await expect(page.getByText("Tema 1 de 1", { exact: true })).toBeVisible();
  });

  test("shows the draft hint next to the composer, not in the header", async ({
    page,
  }) => {
    await abrirCabecera(page);
    await expect(page.getByText("Hay texto sin enviar")).toHaveCount(0);
    await page.getByTestId("multimodal-input").click();
    await page
      .getByTestId("multimodal-input")
      .pressSequentially("Borrador de prueba");
    await expect(page.getByText("Borrador sin enviar")).toBeVisible();
    await expect(
      page.getByTestId("entrevista-cabecera").getByText("Borrador sin enviar")
    ).toHaveCount(0);
  });

  test("keeps save error visible without changing the draft", async ({
    page,
  }) => {
    await abrirCabecera(page, "&guardar=error");
    await page.getByTestId("multimodal-input").click();
    await page
      .getByTestId("multimodal-input")
      .pressSequentially("Sigue el borrador");
    await page
      .getByRole("button", { name: "Guardar" })
      .filter({ visible: true })
      .click();
    await expect(page.getByText("No se pudo guardar")).toBeVisible();
    await expect(page.getByTestId("multimodal-input")).toHaveValue(
      "Sigue el borrador"
    );
  });

  test("returns keyboard focus to the menu trigger after Escape", async ({
    page,
  }) => {
    await abrirCabecera(page);
    const trigger = page.getByRole("button", { name: "Más opciones" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("asks before signing out or leaving with an unsent draft", async ({
    page,
  }) => {
    await abrirCabecera(page, "&rol=cliente");
    await page.getByTestId("multimodal-input").click();
    await page
      .getByTestId("multimodal-input")
      .pressSequentially("Texto pendiente");
    await page.getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "¿Salir de la entrevista?" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Seguir aquí" }).click();
    await expect(page.getByTestId("multimodal-input")).toHaveValue(
      "Texto pendiente"
    );

    await page.getByRole("button", { name: "Más opciones" }).click();
    await page.getByRole("menuitem", { name: "Volver al portal" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "¿Salir de la entrevista?" })
    ).toBeVisible();
  });

  test("keeps the enter-as banner and return to admin", async ({ page }) => {
    await abrirCabecera(page, "&impersonar=1");
    await expect(page.getByRole("status")).toContainText(
      "Estás en el portal como"
    );
    await expect(
      page.getByRole("button", { name: "Volver al admin" })
    ).toBeVisible();
  });
});

for (const width of [320, 430] as const) {
  test.describe(`Interview header at ${width}px`, () => {
    test.use({ viewport: { height: 844, width } });

    test("fits the compact header without hiding save or the menu", async ({
      page,
    }) => {
      await abrirCabecera(
        page,
        `&rol=cliente&email=${encodeURIComponent(correoLargo)}&titulo=${encodeURIComponent(tituloLargo)}`
      );
      const cabecera = page.getByTestId("entrevista-cabecera");
      await expect(
        cabecera.getByText("Tema 1 de 4", { exact: true })
      ).toBeVisible();
      await expect(
        cabecera.getByRole("heading", { name: tituloLargo })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Guardar" }).filter({ visible: true })
      ).toHaveCount(1);
      await expect(
        page.getByRole("button", { name: "Más opciones" }).filter({
          visible: true,
        })
      ).toHaveCount(1);
      const overflowX = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(overflowX).toBe(false);
    });
  });
}

test.describe("Interview desktop header", () => {
  test.use({ viewport: { height: 800, width: 1280 } });

  test("keeps breadcrumb and how-it-works on desktop", async ({ page }) => {
    await abrirCabecera(page, "&rol=cliente");
    await expect(page.getByRole("link", { name: "Fases" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cómo funciona" }).filter({
        visible: true,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Más opciones" }).filter({
        visible: true,
      })
    ).toHaveCount(0);
  });
});
