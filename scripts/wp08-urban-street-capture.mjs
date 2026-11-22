#!/usr/bin/env node
/* global setTimeout, window, document, HTMLElement, fetch, Buffer */
/**
 * D-111.2 FASE 7 · WP08 — la calle urbana poblada a la escala real de Phaser.
 *
 * WP08 pide «al menos una calle urbana poblada a 1440×900, zoom 1× y 0,5×, con vehículos, vegetación,
 * terreno y nuevas fachadas en presentación QA» y, explícitamente, «evitar montajes engañosos que no
 * reflejen la escala de Phaser». El laboratorio de FX no puede firmar esa escala: sus edificios llevan
 * `scale` de presentación (1,6 en la fila frontal) y su vegetación un `SCENERY_BOOST` de 2,1. Aquí no
 * se compone nada: se monta la partida real (`?cameraTest=1`, seed del juego) y se fotografía la cámara
 * del juego. Los vehículos los coloca `planGameplayParkedVehicles`, los peatones el plan de actores
 * ambientales y las fachadas son las promociones `qa_approved` del compositor ya en el bundle runtime.
 *
 * Lo que se registra por imagen (JSON hermano, como exige el cierre de WP08):
 *  - el distrito por nombre y rol, la celda ancla y por qué se ancló ahí, el zoom y el `worldView` real
 *    de la cámara;
 *  - el censo de lo que hay DENTRO de ese rectángulo: edificios por tipo con su sprite, vehículos
 *    aparcados, peatones y cuadrillas, mobiliario, vegetación, fauna, marcas viales y suelo horneado.
 *    Es lo que impide titular «poblada» a un frame vacío;
 *  - `faltaWP08`: la lista de los siete elementos del encargo que NO cayeron en ese encuadre, vacía
 *    cuando la foto sí vale como la «calle urbana poblada» que pide WP08;
 *  - el hash de píxeles, el renderer WebGL y los errores de página.
 *
 * Dos cosas se aprendieron midiendo y por eso están en el arnés, no en la suerte:
 *  1. Las fachadas se cargan perezosamente por distrito (D-102): el primer censo de la corrida
 *     22-11-2026 dio `spritesPintados: 0` en Cívico y Residencial porque se fotografió a tick 186,
 *     segundos después de cambiar de distrito, con el PNG de variante todavía en vuelo. Se espera a
 *     que el renderizador tenga pintado cada edificio proyectado y la espera queda en la evidencia.
 *  2. Un callejero de ciudad nueva está en tierra pelada: a 1 de enero 03:00 no hay aceras, ni
 *     vehículos, ni peatones que fotografiar. El encuadre se hace avanzando el reloj del juego con su
 *     propio botón de velocidad (`» 16×`, el control de la jugadora), sin tocar la simulación.
 *
 * Uso (el bundle tiene que estar construido con el código que se quiere fotografiar):
 *   cd apps/web && npx vite build --emptyOutDir
 *   node scripts/wp08-urban-street-capture.mjs
 *   WP08_GAME_DAYS=90 node scripts/wp08-urban-street-capture.mjs   # más días de callejero
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

/**
 * Puerto pedido al SO. `vite preview` no es estricto: si el puerto está ocupado se muda al siguiente y
 * el arnés fotografía el bundle que dejó escuchando otra fase. La corrida del 22-11-2026 falló justo
 * así: un preview de `dist-fxlab` de FASE 5 seguía vivo en 4314 y el censo no encontró la sonda.
 */
async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

const PORT = await freePort();
const BASE_URL = process.env.WP08_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const OUTPUT_DIR = "docs/art/graphics-capabilities/evidence/v2/urban";
const VIEWPORT = { width: 1440, height: 900 };
/** Los dos zooms que nombra WP08. 0,5 es el que tiene que seguir conservando silueta y huecos (§5.1). */
const ZOOMS = [
  { value: 1, token: "10x" },
  { value: 0.5, token: "05x" },
];
/**
 * Un distrito por familia piloto: cívica, residencial, comercial e industrial. `anchorTypes` es el
 * orden de preferencia para el encuadre; el censo mide lo que realmente cayó en cuadro.
 */
const TARGETS = [
  {
    district: "Centro Cívico",
    family: "civic",
    anchorTypes: ["town_hall", "market_hall", "school_block", "headquarters"],
  },
  {
    district: "Barrio del Umbral",
    family: "residential",
    anchorTypes: ["row_house", "mixed_tenement", "courtyard_home", "apartment_block"],
  },
  {
    district: "Mercado del Norte",
    family: "commercial",
    anchorTypes: ["mixed_tenement", "market_hall", "apartment_block", "workshop"],
  },
  {
    district: "Ensanche Ferroviario Oeste",
    family: "industrial",
    anchorTypes: ["warehouse", "cement_plant", "steelworks", "brickworks", "workshop"],
  },
];
/** Tipos que la hoja tiene que poder señalar: los cuatro pilotos de D-111.2. */
const PILOTS = ["town_hall", "row_house", "mixed_tenement", "warehouse"];
/**
 * Días de simulación que se dejan correr antes de fotografiar (`GAME_DAY_TICKS = 1200` en
 * `packages/simulation/src/game-data.ts:629`). Con 0 la corrida sale como la del 22-11-2026: tierra
 * pelada y siete contadores en rojo. Medido el 22-11-2026 con SwiftShader a `» 16×` (60–160 ticks/s
 * según la carga del frame), el distrito de arranque pasa de `capas: {marcas_viales: 7}` a 47
 * vehículos, 51 muebles de espacio público, 267 adornos de parcela y 64 árboles entre el día 3,3 y
 * el 4,5. Ocho días dan margen sin convertir la corrida en media hora. No es un fixture: es el reloj
 * del juego a su velocidad máxima, el control que usa la jugadora.
 */
const GAME_DAYS = Number(process.env.WP08_GAME_DAYS ?? 8);
/** Techo del adelanto, para que una máquina sin GPU no deje la corrida colgada indefinidamente. */
const MAX_WAIT_MS = Number(process.env.WP08_MAX_WAIT_MS ?? 15 * 60_000);
/**
 * Cuántos edificios candidatos se prueban como ancla de encuadre. Cada prueba son dos ida y vuelta
 * con la página y el hilo principal va saturado por SwiftShader, así que el barrido se limita a las
 * preferidas: `paintedBuildings` ya ordena la lista poniendo los tipos de la familia delante.
 */
const MAX_ANCHOR_CANDIDATES = 4;

const server = process.env.WP08_BASE_URL
  ? null
  : spawn(
      "pnpm",
      ["--filter", "@landlord/web", "preview", "--host", "127.0.0.1", "--port", String(PORT)],
      { stdio: "ignore", detached: true },
    );

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error.message)));
page.on("console", (message) => {
  if (message.type() === "error") pageErrors.push(`console: ${message.text()}`);
});

const sha256 = (source) =>
  createHash("sha256")
    .update(typeof source === "string" ? readFileSync(source) : source)
    .digest("hex");
const log = (message) =>
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${message}\n`);

async function waitForServer() {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 1000 });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error("el servidor de vista previa no arrancó");
}

/**
 * Identidad del bundle fotografiado. Se compara el JS que sirve el servidor con el que acaba de
 * escribir `vite build`: una captura de escala no vale nada si pertenece a otro código, y con previews
 * viejos escuchando el error sería silencioso. Devuelve el par (archivo, sha256) para la procedencia.
 */
async function assertServedBundle() {
  const html = await (await fetch(`${BASE_URL}/`)).text();
  const reference = html.match(/\/assets\/index-[\w.-]+\.js/);
  if (!reference) throw new Error(`${BASE_URL} no sirve un HTML con bundle /assets/index-*.js`);
  const served = Buffer.from(await (await fetch(`${BASE_URL}${reference[0]}`)).arrayBuffer());
  const local = `apps/web/dist${reference[0]}`;
  const disk = readFileSync(local);
  const servedSha = sha256(served);
  const diskSha = sha256(disk);
  if (servedSha !== diskSha) {
    throw new Error(
      `el servidor de ${BASE_URL} enseña otro bundle: ${servedSha.slice(0, 12)} servido vs ` +
        `${diskSha.slice(0, 12)} en ${local}. Hay un preview viejo de otra fase; la escala que se ` +
        "fotografiaría no corresponde al código en revisión.",
    );
  }
  if (!served.includes("listScenery")) {
    throw new Error(
      `el bundle servido no contiene la sonda \`listScenery\`: ${local} es de antes de este cambio. ` +
        "Reconstruir con `cd apps/web && npx vite build --emptyOutDir`.",
    );
  }
  return { archivo: `apps/web/dist${reference[0]}`, sha256: diskSha, bytes: disk.length };
}

/** Ciudad nueva determinista: se borra el IndexedDB para que el seed 1 reconstruya el mismo mundo. */
async function startFreshCity() {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const removal = indexedDB.deleteDatabase("landlord-gate1");
        removal.onsuccess = () => resolve();
        removal.onerror = () => resolve();
        removal.onblocked = () => resolve();
      }),
  );
  await page.goto(`${BASE_URL}?cameraTest=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__landlordCameraTest !== undefined, null, {
    timeout: 60_000,
  });
  await page.getByText("Worker conectado · simulación ejecutándose").waitFor({ timeout: 60_000 });
  await page.waitForFunction(
    () => Boolean(window.__landlordCameraTest?.getProjection?.()),
    null,
    { timeout: 60_000 },
  );
  await dismissOnboarding();
}

/** El onboarding de ciudad nueva deja un backdrop que se come los clics de la HUD. */
async function dismissOnboarding() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const skip = page.getByRole("button", { name: "Ahora no" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click().catch(() => {});
      await page.waitForTimeout(300);
      continue;
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    for (const node of document.querySelectorAll(
      '[class*="onboarding"], [class*="tour"], [class*="modal-backdrop"], [class*="scrim"]',
    )) {
      const style = node instanceof HTMLElement ? window.getComputedStyle(node) : null;
      if (style && (style.position === "fixed" || style.position === "absolute")) {
        node.style.pointerEvents = "none";
        node.style.zIndex = "-1";
      }
    }
  });
}

async function readDistricts() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const button = page.locator(".hud-district");
    if (await button.isVisible().catch(() => false)) break;
    await page.waitForTimeout(1000);
  }
  await page.locator(".hud-district").click({ timeout: 10_000 });
  const tiles = page.locator('[aria-label="Distritos"] [role="gridcell"]');
  await tiles.first().waitFor({ timeout: 15_000 });
  const entries = [];
  for (const tile of await tiles.all()) {
    entries.push({
      name: (await tile.locator("strong").innerText()).trim(),
      role: (await tile.locator(".city-role").innerText()).trim(),
    });
  }
  await page.keyboard.press("Escape");
  return entries;
}

async function selectDistrict(name) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await page.locator(".hud-district").innerText().catch(() => "");
    if (current.includes(name)) return;
    try {
      await page.locator(".hud-district").click({ timeout: 8_000 });
      const tile = page.locator('[aria-label="Distritos"] [role="gridcell"]', { hasText: name });
      await tile.waitFor({ state: "visible", timeout: 8_000 });
      await tile.click({ timeout: 8_000 });
      await page.waitForFunction(
        (expected) =>
          (document.querySelector(".hud-district")?.textContent ?? "").includes(expected),
        name,
        { timeout: 20_000 },
      );
      await page.waitForTimeout(1200);
      await closePanels();
      return;
    } catch {
      await page.keyboard.press("Escape").catch(() => {});
      await dismissOnboarding();
    }
  }
  throw new Error(`no se pudo seleccionar el distrito ${name}`);
}

/**
 * Cierra cualquier panel abierto antes de disparar. La corrida del 22-11-2026 fotografió el
 * «PANEL GLOBAL · Ciudad» tapando el tercio derecho del encuadre: el censo era correcto y la imagen
 * no servía para revisar una fachada. Se informa de lo que quedó abierto en vez de suponerlo.
 */
async function closePanels() {
  let viaEventoDom = false;
  for (let intento = 0; intento < 4; intento += 1) {
    const abiertos = await page.locator('[aria-label="Cerrar panel"]').count().catch(() => 0);
    if (abiertos === 0) break;
    try {
      await page.locator('[aria-label="Cerrar panel"]').first().click({ timeout: 8_000 });
    } catch {
      // Mismo caso que el botón de velocidad: el puntero no pasa la comprobación de estabilidad.
      viaEventoDom = true;
      await page.evaluate(() => document.querySelector('[aria-label="Cerrar panel"]')?.click());
    }
    await page.waitForTimeout(250);
  }
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(250);
  return await page.evaluate((porEvento) => {
    const titulos = [...document.querySelectorAll(".panel h2, .hub h2, .panel h3")]
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean);
    const visor = document.querySelector("canvas")?.getBoundingClientRect();
    const tapones = [...document.querySelectorAll("body *")]
      .filter((node) => {
        if (!(node instanceof HTMLElement) || node.tagName === "CANVAS") return false;
        const style = window.getComputedStyle(node);
        if (style.position !== "fixed" && style.position !== "absolute") return false;
        if (style.visibility === "hidden" || style.opacity === "0") return false;
        const rect = node.getBoundingClientRect();
        if (!visor || rect.width < 200 || rect.height < 200) return false;
        return (
          rect.left < visor.right && rect.right > visor.left && rect.top < visor.bottom && rect.bottom > visor.top
        );
      })
      .map((node) => ({
        clase: String(node.className).slice(0, 60),
        area: Math.round(node.getBoundingClientRect().width * node.getBoundingClientRect().height),
      }))
      .sort((a, b) => b.area - a.area)
      .slice(0, 4);
    return { paneles: titulos, tapones, cierrePorEvento: porEvento };
  }, viaEventoDom);
}

/**
 * Se pulsa el botón de velocidad del HUD invocando su propio handler, sin el baile de acción
 * completa de Playwright: a `» 8×` el hilo principal no deja pasar la comprobación de estabilidad y
 * `locator.click()` expira (medido el 22-11-2026: timeout de 5 s en el cuarto clic). Es el mismo
 * `onClick` que dispara la jugadora, sólo que sin puntero de por medio.
 *
 * Cada pulsación se espera por separado. Cuatro `click()` seguidos dentro del mismo `evaluate` los
 * procesa React contra el mismo estado y el HUD sube UN escalón: la corrida del 22-11-2026 salió
 * con `reloj.velocidad = » 2×` en lugar de `» 16×` y los 8 días tardaron 238 s en vez de 60.
 */
async function pulseSpeedButton(times) {
  for (let paso = 0; paso < times; paso += 1) {
    const antes = await page.evaluate(
      () => document.querySelector(".speed-button")?.textContent?.trim() ?? "",
    );
    await page.evaluate(() => document.querySelector(".speed-button")?.click());
    await page
      .waitForFunction(
        (anterior) =>
          (document.querySelector(".speed-button")?.textContent ?? "").trim() !== anterior,
        antes,
        { timeout: 20_000, polling: 250 },
      )
      .catch(() => {});
  }
  return await page.evaluate(
    () => document.querySelector(".speed-button")?.textContent?.trim() ?? "desconocida",
  );
}

/**
 * Adelanta el reloj con el control de la jugadora (`» 1× → 16×`, `apps/web/src/ui/game-hud.tsx:189`).
 * Es la única forma honesta de fotografiar una calle poblada: el callejero, los solares edificados y
 * el dressing los produce la simulación, y WP08 prohíbe los montajes que no reflejen la escala real.
 */
async function advanceClock(targetTick) {
  const velocidad = await pulseSpeedButton(4);
  const inicio = await page.evaluate(() => window.__landlordCameraTest.getProjection().tick);
  const t0 = Date.now();
  /**
   * Una sola espera sobre la página: sondear el tick desde Node resultó caro (cada `evaluate` a 16×
   * tardaba entre 10 y 80 s con SwiftShader y se comía el adelanto).
   */
  let alcanzado = true;
  try {
    await page.waitForFunction(
      (objetivo) => window.__landlordCameraTest.getProjection().tick >= objetivo,
      targetTick,
      { timeout: MAX_WAIT_MS, polling: 2_000 },
    );
  } catch {
    alcanzado = false;
  }
  const fin = Date.now();
  const final = await page.evaluate(() => window.__landlordCameraTest.getProjection().tick);
  /** Se vuelve a 1× antes de encuadrar: 16× deja el hilo principal saturado y el disparo sale lento. */
  const velocidadDisparo = await pulseSpeedButton(1);
  return {
    velocidad: velocidad.trim(),
    velocidadAlDisparar: velocidadDisparo.trim(),
    ticksPorSegundo: Number(((final - inicio) / Math.max(1, (fin - t0) / 1000)).toFixed(1)),
    tickInicial: inicio,
    tickFinal: final,
    diasSimulados: Number(((final - inicio) / 1_200).toFixed(1)),
    segundosReales: Math.round((fin - t0) / 1000),
    objetivoAlcanzado: alcanzado,
  };
}

/**
 * Pausa la simulación con el botón del HUD (`apps/web/src/ui/game-hud.tsx:180`) antes de encuadrar.
 * Sin pausa el reloj sigue corriendo entre el encuadre, el censo y el disparo —medido: el tick que
 * ve el renderizador sube ~1400/s a `» 16×`— y el JSON describiría un fotograma distinto del PNG.
 * No se toca ninguna regla: es el mismo control que usa la jugadora, y WP08 pide comparar lo que el
 * juego produce, no cuándo.
 */
async function pauseSimulation() {
  const leerTick = () => page.evaluate(() => window.__landlordCameraTest.getProjection().tick);
  const inicio = await leerTick();
  await page.evaluate(() => document.querySelector('[aria-label="Pausar simulación"]')?.click());
  /**
   * El worker ya tenía proyecciones en vuelo, así que el tick del renderizador sigue subiendo un
   * rato después de pausar y luego se queda quieto. Medido el 22-11-2026: 34578 → 36198 en los
   * primeros 0,8 s y 36199 durante los 34 s siguientes de captura. Se espera al asiento porque lo
   * que hace falta afirmar es que censo y PNG son el MISMO fotograma, no que se pulsó la pausa.
   */
  let releido = inicio;
  let quietos = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 20_000 && quietos < 2) {
    await page.waitForTimeout(700);
    const siguiente = await leerTick();
    quietos = siguiente === releido ? quietos + 1 : 0;
    releido = siguiente;
  }
  return {
    boton: await page.evaluate(
      () => document.querySelector('[aria-label*="simulación"]')?.getAttribute("aria-label") ?? null,
    ),
    tickAlPausar: inicio,
    tickAsentado: releido,
    msHastaAsentar: Date.now() - t0,
    congelado: quietos >= 2,
  };
}

/**
 * Espera a que el renderizador tenga pintado cada edificio proyectado del distrito observado. Las
 * variantes se cargan bajo demanda (`ensureVariantTexture`, D-102), así que «sin fachadas» puede ser
 * sólo un fotograma demasiado pronto; la espera deja constancia de cuál de los dos casos fue.
 */
async function waitForFacades(timeoutMs = 120_000) {
  const t0 = Date.now();
  try {
    // `waitForFunction` se satisface con cualquier valor verdadero: un objeto siempre lo es, así que
    // mientras queda alguna fachada pendiente hay que devolver `false` de forma explícita.
    const handle = await page.waitForFunction(
      () => {
        const api = window.__landlordCameraTest;
        const projection = api.getProjection();
        const pintados = new Set(api.listScenery().buildings.map((sprite) => sprite.id));
        const edificios = (projection.economy?.buildings ?? []).filter(
          (entry) => entry.districtId === projection.observedDistrictId,
        );
        const faltan = edificios
          .filter((entry) => !pintados.has(`building:${entry.id}`))
          .map((entry) => `${entry.type}:${entry.state}:${entry.orientation}`);
        return faltan.length === 0 ? { total: edificios.length, faltan } : false;
      },
      null,
      { timeout: timeoutMs, polling: 1_500 },
    );
    return { ms: Date.now() - t0, agotado: false, ...(await handle.jsonValue()) };
  } catch {
    const parcial = await page.evaluate(
      () => {
        const api = window.__landlordCameraTest;
        const projection = api.getProjection();
        const pintados = new Set(api.listScenery().buildings.map((sprite) => sprite.id));
        const edificios = (projection.economy?.buildings ?? []).filter(
          (entry) => entry.districtId === projection.observedDistrictId,
        );
        const faltan = edificios
          .filter((entry) => !pintados.has(`building:${entry.id}`))
          .map((entry) => `${entry.type}:${entry.state}:${entry.orientation}`);
        return { total: edificios.length, faltan };
      },
    );
    return { ms: Date.now() - t0, agotado: true, ...parcial };
  }
}

/**
 * Ancla y encuadre por la API de cámara del juego, la misma ruta que usó V.h. No se toca el DOM del
 * canvas ni se inyecta proyección: la escena es la del juego.
 *
 * `centerOnCell` razona con el zoom en 1 —deja `scroll = mundo − tamaño/2`— así que a 0,5 el centro del
 * mundo se va `tamaño·(1/2z − 1/2)` celdas. El encuadre se cierra iterando el delta de pantalla
 * (`pantalla = (mundo − scroll)·zoom`), que es lo que hace la rueda del ratón en la escena, en vez de
 * copiar aquí el tamaño de la cámara o la rejilla isométrica. Devuelve la convergencia por si falla.
 */
async function frame(target, zoom, settleMs = 900) {
  const convergencia = await page.evaluate(
    ({ ancla, value }) => {
      const api = window.__landlordCameraTest;
      const canvas = document.querySelector("canvas");
      const centro = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 };
      /**
       * Se enmarca sobre el sprite que puso el renderizador (`getEntityScreenPoint`), no sobre la celda
       * que este script cree que ocupa: desde H2-01 los edificios se colocan por su `footprintCells`
       * real y el centroide redondeado de la parcela ya no es necesariamente el centro de la fachada.
       */
      const punto = () =>
        (ancla.entityId ? api.getEntityScreenPoint(ancla.entityId) : null) ??
        api.getCellScreenPoint(ancla.cell);
      api.configure({ ...api.getCamera(), zoom: value });
      const intentos = [];
      for (let paso = 0; paso < 4; paso += 1) {
        const pantalla = punto();
        const scroll = api.getCamera();
        intentos.push({
          x: Number((pantalla.x - centro.x).toFixed(1)),
          y: Number((pantalla.y - centro.y).toFixed(1)),
        });
        if (Math.abs(pantalla.x - centro.x) < 1 && Math.abs(pantalla.y - centro.y) < 1) break;
        api.configure({
          zoom: value,
          scrollX: scroll.scrollX + (pantalla.x - centro.x) / value,
          scrollY: scroll.scrollY + (pantalla.y - centro.y) / value,
        });
      }
      return intentos;
    },
    { ancla: target, value: zoom },
  );
  // El mundo es isométrico con sprites que se reubican por frame: dos fotogramas de margen.
  await page.waitForTimeout(settleMs);
  return convergencia;
}

/**
 * Edificios del distrito observado que ya tienen sprite pintado, con la celda de su huella como
 * respaldo. Es la lista de anclas posibles: no se encuadra sobre algo que el renderizador no tiene.
 */
async function paintedBuildings(preferredTypes) {
  return await page.evaluate(
    (preferidos) => {
      const api = window.__landlordCameraTest;
      const projection = api.getProjection();
      const pintados = new Set(api.listScenery().buildings.map((sprite) => sprite.id));
      const edificios = (projection.economy?.buildings ?? []).filter(
        (entry) =>
          entry.districtId === projection.observedDistrictId &&
          pintados.has(`building:${entry.id}`) &&
          (entry.footprintCells?.length ?? 0) > 0,
      );
      const centro = (cells) => ({
        x: Math.round(cells.reduce((s, c) => s + c.x, 0) / cells.length),
        y: Math.round(cells.reduce((s, c) => s + c.y, 0) / cells.length),
      });
      const filas = edificios.map((entry) => ({
        entityId: entry.id,
        type: entry.type,
        cell: centro(entry.footprintCells),
      }));
      const preferidas = filas.filter((f) => preferidos.includes(f.type));
      const resto = filas.filter((f) => !preferidos.includes(f.type));
      return [...preferidas, ...resto].slice(0, 8);
    },
    preferredTypes,
  );
}

/**
 * Qué ancla conviene: se reencuadra sobre cada candidata y se cuenta cuántos edificios del distrito
 * tiene el renderizador dibujados dentro del `worldView` de la cámara. El desempate favorece a los
 * pilotos de D-111.2, que son los que la hoja comparativa tiene que poder señalar. Se hace con la
 * cámara del juego y el propio `worldView`, así que el número describe el fotograma que se va a
 * disparar, no una fórmula copiada.
 */
async function chooseAnchor(candidates, zoom) {
  const ranking = [];
  for (const candidate of candidates.slice(0, MAX_ANCHOR_CANDIDATES)) {
    await frame(candidate, zoom, 0);
    const medida = await page.evaluate(
      (ancla) => {
        const api = window.__landlordCameraTest;
        const scenery = api.listScenery();
        const view = scenery.worldView;
        // `worldView` llega serializado: un Rectángulo de Phaser tiene `right`/`bottom` como getters
        // y un objeto JSON no, así que comparar contra ellos devolvía `false` para TODO.
        const dentro = (x, y) =>
          x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height;
        const proyeccion = api.getProjection();
        const tipo = new Map(
          (proyeccion.economy?.buildings ?? []).map((entry) => [entry.id, entry.type]),
        );
        const cuadrados = scenery.buildings.filter((sprite) => dentro(sprite.x, sprite.y));
        /**
         * El ancla se elige por lo que el PNG va a dibujar, no por lo que cae en el rectángulo: el
         * renderizador corta los sprites por su centro visual con 96 px de holgura
         * (`IsometricSpikeScene.ts:2518`), así que un edificio geométricamente en cuadro puede estar
         * con `visible:false` y no aparecer en la foto. `despoblados` deja medido ese caso aparte.
         */
        const pintados = cuadrados.filter((sprite) => sprite.visible);
        const centrada = api.getEntityScreenPoint(ancla.entityId);
        const canvas = document.querySelector("canvas");
        return {
          enCuadre: cuadrados.length,
          pintados: pintados.length,
          despoblados: cuadrados.length - pintados.length,
          tipos: [...new Set(pintados.map((sprite) => tipo.get(sprite.id.replace(/^building:/, ""))))]
            .sort(),
          desvioCentrado: centrada
            ? {
                x: Math.round(centrada.x - canvas.clientWidth / 2),
                y: Math.round(centrada.y - canvas.clientHeight / 2),
              }
            : null,
        };
      },
      candidate,
    );
    ranking.push({ ...candidate, ...medida });
  }
  const esPiloto = (fila) => (PILOTS.includes(fila.type) ? 1 : 0);
  ranking.sort(
    (a, b) => b.pintados - a.pintados || esPiloto(b) - esPiloto(a) || a.entityId.localeCompare(b.entityId),
  );
  return { ancla: ranking[0] ?? null, ranking };
}

/**
 * Censo de lo que hay en el fotograma. Se cruzan las dos mitades que existen: `listScenery()` dice qué
 * tiene pintado el renderizador y `getProjection()` qué hay en el dominio; la ventana la aporta la
 * propia cámara de Phaser. Por eso aquí NO se copia `REFERENCE_LAYOUT`: si cambia la proyección
 * isométrica cambian a la vez el censo y el dibujo, y no puede quedar un «calle poblada» calculado
 * sobre una rejilla que ya no es la del juego.
 */
async function census(anchor) {
  return await page.evaluate(
    ([pilotTypes, ancla]) => {
      const api = window.__landlordCameraTest;
      const projection = api.getProjection();
      const scenery = api.listScenery();
      const view = scenery.worldView;
      const canvas = document.querySelector("canvas");
      // Mismo detalle que en `chooseAnchor`: `worldView` viene serializado y no tiene `right`/`bottom`.
      const dentro = (x, y) =>
        x >= view.x && x <= view.x + view.width && y >= view.y && y <= view.y + view.height;
      /**
       * Auto-comprobación del encuadre: el punto sale de la matriz de la cámara, no de una fórmula
       * repetida en este script. Se mide sobre el sprite si el ancla es un edificio pintado; la celda
       * queda como respaldo para los casos en que el renderizador aún no tiene nada que centrar.
       */
      const anclaPantalla =
        (ancla.entityId ? api.getEntityScreenPoint(ancla.entityId) : null) ??
        api.getCellScreenPoint(ancla.cell);
      const desviacionPx = {
        x: Math.round(anclaPantalla.x - canvas.clientWidth / 2),
        y: Math.round(anclaPantalla.y - canvas.clientHeight / 2),
      };
      const sprites = new Map(scenery.buildings.map((sprite) => [sprite.id, sprite]));
      const edificios = (projection.economy?.buildings ?? []).filter(
        (entry) => entry.districtId === projection.observedDistrictId,
      );
      const porTipo = {};
      const pilotosEnCuadre = [];
      const sinSprite = [];
      /** Por edificio proyectado: qué sprite le corresponde y dónde está. Es la prueba de la fachada. */
      const fachadas = [];
      let edificiosEnCuadre = 0;
      for (const building of edificios) {
        const pintados = [
          building.id,
          `building:${building.id}`,
          `site:${building.id}`,
        ]
          .map((key) => sprites.get(key))
          .filter(Boolean);
        const enCuadre = pintados.some((sprite) => sprite.visible && dentro(sprite.x, sprite.y));
        if (fachadas.length < 24) {
          fachadas.push({
            id: building.id,
            type: building.type,
            state: building.state,
            orientation: building.orientation,
            enCuadre,
            sprite: pintados.map((sprite) => ({
              x: Math.round(sprite.x),
              y: Math.round(sprite.y),
              texture: sprite.texture,
              scale: Number(sprite.scale.toFixed(4)),
              visible: sprite.visible,
            })),
          });
        }
        const fila = (porTipo[building.type] ??= { distrito: 0, enCuadre: 0, sinSprite: 0 });
        fila.distrito += 1;
        if (pintados.length === 0) {
          fila.sinSprite += 1;
          if (sinSprite.length < 20) sinSprite.push({ id: building.id, type: building.type });
        }
        if (!enCuadre) continue;
        fila.enCuadre += 1;
        edificiosEnCuadre += 1;
        if (pilotTypes.includes(building.type) && pilotosEnCuadre.length < 24) {
          pilotosEnCuadre.push({
            id: building.id,
            type: building.type,
            orientation: building.orientation,
            floors: building.floors,
            condition: building.condition,
            structuralIntegrity: building.structuralIntegrity,
            state: building.state,
            sprite: pintados.map((sprite) => ({
              texture: sprite.texture,
              scale: Number(sprite.scale.toFixed(3)),
              visible: sprite.visible,
            })),
          });
        }
      }
      const capas = Object.fromEntries(
        scenery.layers.map((entry) => [
          entry.layer,
          {
            total: entry.total,
            enCuadre: entry.enCuadre,
            visibles: entry.visibles,
            pintados: entry.pintados,
            texturas: entry.texturas,
          },
        ]),
      );
      /**
       * Se suma `pintados`, no `enCuadre`: lo que hay que probar es que el elemento aparece en el PNG.
       * `enCuadre` sigue guardado en la evidencia para poder leer la diferencia entre «existe en el
       * encuadre» y «el renderizador lo está dibujando».
       */
      const suma = (...nombres) =>
        nombres.reduce((t, nombre) => t + (capas[nombre]?.pintados ?? 0), 0);
      const peatones = suma("peatones_ambientales", "cuadrillas");
      const mobiliario = suma("mobiliario_calle", "mobiliario_espacio_publico");
      /**
       * WP08 nombra los seis elementos que tienen que estar en el mismo fotograma. Se comprueba uno a
       * uno y lo que falta se escribe en la evidencia: «poblada» deja de ser una palabra del script.
       * «nuevas fachadas» está en plural en el encargo, así que el umbral son dos edificios pintados
       * en cuadro; el número real de proyectados y de en-cuadro se guarda aparte, no se negocia aquí.
       */
      const exige = [
        ["fachadas", edificiosEnCuadre >= 2],
        ["piloto WP06", pilotosEnCuadre.length > 0],
        ["vehículos", suma("vehiculos_aparcados") > 0],
        ["peatones", peatones > 0],
        ["vegetación", suma("vegetacion") > 0],
        ["mobiliario", mobiliario > 0],
        ["terreno horneado", scenery.terrain.baked],
      ];
      const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl") ?? null;
      const info = gl?.getExtension("WEBGL_debug_renderer_info") ?? null;
      return {
        observedDistrictId: projection.observedDistrictId,
        tick: projection.tick,
        worldView: { x: view.x, y: view.y, width: view.width, height: view.height },
        zoom: api.getCamera().zoom,
        anclaEnPantalla: { x: Math.round(anclaPantalla.x), y: Math.round(anclaPantalla.y) },
        desviacionPx,
        canvasCss: { width: canvas.clientWidth, height: canvas.clientHeight },
        canvasBuffer: canvas ? { width: canvas.width, height: canvas.height } : null,
        glRenderer: info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null,
        roads: {
          revision: projection.map.roads.revision,
          digest: projection.map.roads.digest,
          celdasMapa: projection.map.roads.cells.length,
        },
        roadSection: {
          revision: projection.map.roadSection.revision,
          perfiles: projection.map.roadSection.profiles.map((p) => p.id ?? p.profileId ?? null),
          segmentos: projection.map.roadSection.segments.length,
        },
        terreno: scenery.terrain,
        spritesPintados: scenery.buildings.length,
        fachadas,
        porTipo,
        edificiosDistrito: edificios.length,
        edificiosEnCuadre,
        pilotosEnCuadre,
        sinSprite,
        capas,
        peatonesDistrito: (projection.agents ?? []).filter(
          (agent) => agent.districtId === projection.observedDistrictId,
        ).length,
        faltaWP08: exige.filter(([, ok]) => !ok).map(([nombre]) => nombre),
        detalleWP08: Object.fromEntries(exige),
      };
    },
    [PILOTS, anchor],
  );
}

const shots = [];
const bundle = { archivo: null, sha256: null, bytes: 0 };
/** Filas que tienen los siete contadores en el mismo fotograma: las que valen como «calle poblada». */
let pobladas = [];
let runError = null;
/** Adelanto del reloj del juego hecho con su propio botón; se apunta en el manifiesto entero. */
let reloj = null;
/** La pausa con la que se disparó: sin ella el censo y el PNG serían fotogramas distintos. */
let pausa = null;

try {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  await waitForServer();
  Object.assign(bundle, await assertServedBundle());
  log(`servidor arriba sobre el bundle ${bundle.sha256.slice(0, 12)}`);
  await startFreshCity();
  log("ciudad nueva con proyección");
  const districts = await readDistricts();
  await closePanels();
  log(`distritos: ${districts.map((d) => d.name).join(", ")}`);
  reloj = await advanceClock(GAME_DAYS * 1_200);
  log(
    `reloj ${reloj.velocidad} · ${reloj.diasSimulados} días en ${reloj.segundosReales} s · ` +
      `tick ${reloj.tickInicial}→${reloj.tickFinal}${reloj.objetivoAlcanzado ? "" : " (OBJETIVO NO ALCANZADO)"}`,
  );
  pausa = await pauseSimulation();
  log(
    `reloj pausado: tick asentado en ${pausa.tickAsentado} (desde ${pausa.tickAlPausar} en ` +
      `${pausa.msHastaAsentar} ms) · botón «${pausa.boton ?? "desconocido"}»` +
      (pausa.congelado ? "" : " · NO CONGELÓ: censo y PNG serían fotogramas distintos"),
  );

  for (const target of TARGETS) {
    const known = districts.find((d) => d.name === target.district);
    if (!known) throw new Error(`el distrito ${target.district} no está en la HUD`);
    await selectDistrict(target.district);
    log(`  ${target.district} (${target.family}) · encuadrando`);
    const esperaFachadas = await waitForFacades();
    if (esperaFachadas.faltan.length > 0) {
      log(
        `  fachadas pendientes tras ${esperaFachadas.ms} ms${esperaFachadas.agotado ? " (espera agotada)" : ""}: ` +
          `${esperaFachadas.faltan.join(", ")}`,
      );
    }
    const candidatos = await paintedBuildings(target.anchorTypes);
    const paneles = await closePanels();
    for (const zoom of ZOOMS) {
      const name = `urban_${target.family}_${zoom.token}`;
      const eleccion = await chooseAnchor(candidatos, zoom.value);
      const anchor =
        eleccion.ancla ??
        ({
          entityId: null,
          type: null,
          cell: (await page.evaluate(() => window.__landlordUiTest?.largestMarketableParcel?.()?.cell ?? { x: 32, y: 32 })),
          ancladoPor: "solar-vacio (sin edificios pintados en el distrito)",
        });
      const convergencia = await frame(anchor, zoom.value);
      const row = await census(anchor);
      if (Math.abs(row.desviacionPx.x) > 32 || Math.abs(row.desviacionPx.y) > 32) {
        throw new Error(
          `el ancla no quedó en el centro del encuadre en ${name}: desvío ` +
            `${row.desviacionPx.x},${row.desviacionPx.y} px sobre un canvas de ` +
            `${row.canvasCss.width}×${row.canvasCss.height}, convergencia ` +
            `${JSON.stringify(convergencia)}. El censo describiría otro cuadro.`,
        );
      }
      const path = `${OUTPUT_DIR}/${name}.png`;
      await page.screenshot({ path, type: "png" });
      const provenance = {
        schemaVersion: 1,
        generatedBy: "scripts/wp08-urban-street-capture.mjs",
        command: "node scripts/wp08-urban-street-capture.mjs",
        caso: name,
        familiaPiloto: target.family,
        distrito: known,
        reloj,
        pausa,
        diasObjetivo: GAME_DAYS,
        esperaFachadas,
        ancla: anchor,
        eleccionEncuadre: eleccion.ranking.map(
          ({ entityId, type, enCuadre, pintados, despoblados, tipos }) => ({
            entityId,
            type,
            enCuadre,
            pintados,
            despoblados,
            tipos,
          }),
        ),
        convergenciaEncuadre: convergencia,
        chrome: paneles,
        zoomPedido: zoom.value,
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        ruta: "apps/web/src/App.tsx → IsometricSpikeScene (?cameraTest=1, ciudad nueva seed 1)",
        escala:
          "cámara y escala del juego: los sprites se colocan con `spriteScaleFor`/`CHARACTER_RENDER_SCALE`, sin los boosts de presentación del laboratorio FX",
        metodologia:
          "censo cruzando `listScenery()` (qué tiene pintado el renderizador) con `getProjection()` (qué hay en el dominio) dentro del `worldView` de la cámara",
        imagen: { path, bytes: readFileSync(path).length, sha256: sha256(path) },
        bundle,
        cumpleWP08: row.faltaWP08.length === 0,
        faltaWP08: row.faltaWP08,
        pageErrors: [...pageErrors],
        ...row,
      };
      writeFileSync(`${OUTPUT_DIR}/${name}.json`, `${JSON.stringify(provenance, null, 1)}\n`, "utf8");
      /** Contadores de dressing: los que el renderizador tiene dibujados en este fotograma. */
      const capa = (n) => row.capas[n]?.pintados ?? 0;
      shots.push({
        caso: name,
        distrito: known.name,
        ancla: anchor,
        zoom: zoom.value,
        tick: row.tick,
        worldView: row.worldView,
        edificiosEnCuadre: row.edificiosEnCuadre,
        pilotosEnCuadre: row.pilotosEnCuadre.map((p) => p.type),
        vehiculos: capa("vehiculos_aparcados"),
        peatones: capa("peatones_ambientales") + capa("cuadrillas"),
        vegetacion: capa("vegetacion"),
        mobiliario: capa("mobiliario_calle") + capa("mobiliario_espacio_publico"),
        terreno: row.terreno,
        chrome: paneles,
        faltaWP08: row.faltaWP08,
        glRenderer: row.glRenderer,
        sha256: provenance.imagen.sha256,
        path,
      });
      log(
        `✓ ${name} · tick ${row.tick} · ancla ${anchor.type ?? "solar"} · edificios ${
          row.edificiosEnCuadre
        }/${row.edificiosDistrito} · pilotos ${
          row.pilotosEnCuadre.map((p) => p.type).join("/") || "ninguno"
        } · vehículos ${capa("vehiculos_aparcados")} · peatones ${
          capa("peatones_ambientales") + capa("cuadrillas")
        } · vegetación ${capa("vegetacion")} · mobiliario ${
          capa("mobiliario_calle") + capa("mobiliario_espacio_publico")
        } · desvío ${row.desviacionPx.x},${row.desviacionPx.y}px${
          row.faltaWP08.length ? ` · FALTA: ${row.faltaWP08.join(", ")}` : ""
        }`,
      );
    }
  }
  /** WP08 exige al menos UNA calle poblada: si ninguna la cumple, la corrida no se firma como ok. */
  pobladas = shots.filter((shot) => shot.faltaWP08.length === 0);
  if (pobladas.length === 0) {
    runError =
      `ninguna de las ${shots.length} capturas tiene los siete contadores del censo en cuadro en el ` +
      `mismo fotograma. Última fila: ${JSON.stringify(shots.at(-1)?.faltaWP08 ?? "sin filas")}. ` +
      "Se conserva la evidencia tal cual y se declara SIN EVIDENCIA de calle poblada.";
  }
} catch (error) {
  runError = String(error?.stack ?? error);
} finally {
  const manifest = {
    schemaVersion: 1,
    generatedBy: "scripts/wp08-urban-street-capture.mjs",
    command: "node scripts/wp08-urban-street-capture.mjs",
    task: "D-111.2 FASE 7 · WP08 — calle urbana poblada a escala real de Phaser (1440×900, 1× y 0,5×)",
    baseUrl: BASE_URL,
    bundle,
    viewport: VIEWPORT,
    /** El reloj con el que se pobló el callejero: botón `»` del HUD, sin tocar la simulación. */
    diasObjetivo: GAME_DAYS,
    reloj,
    /** Con el reloj en pausa el censo y el PNG son del mismo fotograma. */
    pausa,
    pilots: PILOTS,
    /** Censo por fila: los contadores que el renderizador tenía pintados dentro del `worldView`. */
    shots,
    pobladas: pobladas.map((shot) => shot.caso),
    pageErrors,
    runError,
  };
  writeFileSync(`${OUTPUT_DIR}/urban_street_manifest.json`, `${JSON.stringify(manifest, null, 1)}\n`);
  console.log(
    JSON.stringify(
      {
        status: runError ? "error" : "ok",
        bundle: bundle.sha256?.slice(0, 12) ?? null,
        shots: shots.length,
        pobladas: pobladas.map((shot) => `${shot.distrito}@${shot.zoom}x`),
        resumen: shots.map((shot) => ({
          caso: shot.caso,
          edificios: shot.edificiosEnCuadre,
          pilotos: shot.pilotosEnCuadre,
          vehiculos: shot.vehiculos,
          peatones: shot.peatones,
          vegetacion: shot.vegetacion,
          mobiliario: shot.mobiliario,
          falta: shot.faltaWP08,
        })),
        runError,
        pageErrors,
      },
      null,
      1,
    ),
  );
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid);
    } catch {
      // el preview ya había caído
    }
  }
}
