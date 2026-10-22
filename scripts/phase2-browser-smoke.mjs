import { chromium } from "@playwright/test";

const baseUrl = process.env.PHASE2_BASE_URL ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(baseUrl);
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 10000 });
  const canvas = page.locator("canvas").first();
  let parcelFound = false;
  for (const position of [
    { x: 512, y: 288 },
    { x: 576, y: 320 },
    { x: 640, y: 352 },
    { x: 704, y: 384 },
  ]) {
    await canvas.click({ position });
    await page.waitForTimeout(30);
    const inspector = await page.getByLabel("Inspección de parcela").innerText();
    if (inspector.includes("Disponible")) {
      parcelFound = true;
      break;
    }
  }
  if (!parcelFound) throw new Error("No se encontró una parcela disponible en el canvas");
  await page.getByRole("button", { name: "Comprar parcela" }).click();
  await page.getByText(/Parcela comprada/).waitFor();
  await page.locator("button.construction-option").first().click();
  await page.getByText(/en construcción/).waitFor();
  await page.waitForTimeout(1200);
  await page.getByText(/1 edificios/).waitFor();
  await page
    .getByRole("button", { name: /Ocupar con/ })
    .first()
    .click();
  await page.getByText(/Inquilino asignado/).waitFor();
  await page.getByRole("button", { name: "Promover ordenanza" }).click();
  await page.getByText(/Ordenanza aprobada/).waitFor();
  await page.getByRole("button", { name: "Guardar" }).click();
  await page.getByText("Snapshot guardado en IndexedDB").waitFor();
  await page.getByRole("button", { name: "Cargar" }).click();
  await page.getByText(/Snapshot cargado/).waitFor();
  await page.getByRole("button", { name: "Ocultar panel" }).click();
  if ((await page.locator("#operations-panel").getAttribute("aria-hidden")) !== "true") {
    throw new Error("El panel operativo no se plegó");
  }
  await page.getByRole("button", { name: "Abrir panel" }).click();
  if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
  console.log(
    JSON.stringify({
      status: await page.locator('[role="status"]').innerText(),
      selected: await page.getByLabel("Inspección de parcela").innerText(),
      metrics: (await page.locator("main").innerText()).match(/CAJA\n.*|ACTIVOS\n.*/g),
    }),
  );
} finally {
  await browser.close();
}
