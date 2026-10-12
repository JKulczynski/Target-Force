// Test kreatora strony akcji (12.10): konto Organizacji testowej ustawia zdjecie, kolor, cel, tekst przycisku
// i podziekowanie, zapisuje, a strona publiczna pokazuje zmiany. Na koncu przywraca wyglad do pustego.
// Uzycie: node scripts/e2e-kreator-strony.mjs <katalog> <plik_z_haslem> <id_kampanii> [slug] [adres]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "C:/Users/kulcz/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright",
);
const [katalog, plikHasla, idKampanii, slug = "test-mieszkanca-automat", adres = "https://target-force.vercel.app"] =
  process.argv.slice(2);
if (!katalog || !plikHasla || !idKampanii) {
  console.error("Uzycie: node scripts/e2e-kreator-strony.mjs <katalog> <plik_z_haslem> <id_kampanii> [slug] [adres]");
  process.exit(2);
}
fs.mkdirSync(katalog, { recursive: true });
const haslo = fs.readFileSync(plikHasla, "utf8").trim();

// Maly PNG 64x36 w jednym kolorze, zeby nie trzymac plikow w repo.
function png(szer, wys, [r, g, b]) {
  const crcTab = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTab[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const kawalek = (typ, dane) => {
    const d = Buffer.concat([Buffer.from(typ), dane]);
    const dl = Buffer.alloc(4);
    dl.writeUInt32BE(dane.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(d));
    return Buffer.concat([dl, d, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(szer, 0);
  ihdr.writeUInt32BE(wys, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const wiersz = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: szer }, () => [r, g, b]).flat())]);
  const surowe = Buffer.concat(Array.from({ length: wys }, () => wiersz));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    kawalek("IHDR", ihdr),
    kawalek("IDAT", zlib.deflateSync(surowe)),
    kawalek("IEND", Buffer.alloc(0)),
  ]);
}
const plikObrazu = path.join(katalog, "obraz-testowy.png");
fs.writeFileSync(plikObrazu, png(64, 36, [30, 90, 160]));

const wyniki = [];
let nr = 0;
const przegladarka = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXE ?? "C:/Users/kulcz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
});
const kontekst = await przegladarka.newContext({ viewport: { width: 1360, height: 900 }, locale: "pl-PL" });
await kontekst.addCookies([{ name: "tf_lang", value: "pl", url: adres }]);
const s = await kontekst.newPage();

async function krok(nazwa, fn) {
  nr += 1;
  const plik = path.join(katalog, `${String(nr).padStart(2, "0")}-${nazwa}.png`);
  try {
    await fn();
    await s.screenshot({ path: plik, fullPage: true });
    wyniki.push(`OK    ${nr}. ${nazwa}`);
  } catch (e) {
    await s.screenshot({ path: plik, fullPage: true }).catch(() => {});
    wyniki.push(`BLAD  ${nr}. ${nazwa}: ${e.message.split("\n")[0]}`);
    throw e;
  }
}

try {
  await krok("logowanie", async () => {
    await s.goto(`${adres}/login`, { waitUntil: "load" });
    await s.fill("input[name=email]", process.env.E2E_EMAIL ?? "kulczynski.jan.tomasz+tfpodglad@gmail.com");
    await s.fill("input[name=password]", haslo);
    await Promise.all([s.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 }), s.click('button:has-text("Zaloguj")')]);
  });

  await krok("panel-link-do-kreatora", async () => {
    await s.goto(`${adres}/kampanie/${idKampanii}`, { waitUntil: "load" });
    await s.getByText("Zaprojektuj stronę").click();
    await s.waitForURL(/\/strona$/, { timeout: 20000 });
    await s.getByRole("heading", { name: "Strona akcji" }).waitFor({ timeout: 20000 });
  });

  await krok("kreator-ustawienia", async () => {
    await s.locator('input[type="file"]').first().setInputFiles(plikObrazu);
    await s.getByText("Zmień").first().waitFor({ timeout: 30000 });
    await s.getByText("Zdjęcie na całą szerokość").click();
    await s.locator('input[type="color"]').fill("#1e5aa0");
    await s.getByLabel("Cel: ilu osób potrzebujecie (pasek postępu)").fill("500");
    await s.getByLabel("Tekst przycisku").fill("Dołącz do mieszkańców");
    await s.getByLabel("Podziękowanie i kolejny krok").fill("Dziękujemy! Przyjdź na sesję rady 20 października.");
    // Podgląd aktualizuje się na żywo.
    await s.getByText("Dołącz do mieszkańców").first().waitFor({ timeout: 5000 });
    await s.getByText("0 z 500 osób, których potrzebujemy").first().waitFor({ timeout: 5000 });
  });

  await krok("podglad-komputer", async () => {
    await s.getByRole("button", { name: "Komputer" }).click();
  });

  await krok("zapis", async () => {
    await s.getByRole("button", { name: "Zapisz stronę" }).click();
    await s.getByText("Zapisano. Zmiany są już na stronie.").waitFor({ timeout: 20000 });
  });

  await krok("strona-publiczna", async () => {
    await s.goto(`${adres}/a/${slug}`, { waitUntil: "load" });
    await s.getByRole("button", { name: "Dołącz do mieszkańców" }).waitFor({ timeout: 20000 });
    await s.getByText(/z 500 osób, których potrzebujemy/).waitFor();
    const src = await s.locator("img").first().getAttribute("src");
    if (!src?.includes("/storage/v1/object/public/akcja/")) throw new Error(`zdjecie nie z magazynu: ${src}`);
    const kolor = await s.getByRole("button", { name: "Dołącz do mieszkańców" }).evaluate((el) => getComputedStyle(el).backgroundColor);
    if (kolor !== "rgb(30, 90, 160)") throw new Error(`kolor przycisku ${kolor}`);
  });

  await krok("przywrocenie", async () => {
    await s.goto(`${adres}/kampanie/${idKampanii}/strona`, { waitUntil: "load" });
    await s.getByRole("heading", { name: "Strona akcji" }).waitFor({ timeout: 20000 });
    await s.getByText("Usuń").first().click();
    await s.getByText("Kolor WinOver").click();
    await s.getByLabel("Cel: ilu osób potrzebujecie (pasek postępu)").fill("");
    await s.getByLabel("Tekst przycisku").fill("");
    await s.getByLabel("Podziękowanie i kolejny krok").fill("");
    await s.getByText("Zdjęcie przy treści").click();
    await s.getByRole("button", { name: "Zapisz stronę" }).click();
    await s.getByText("Zapisano. Zmiany są już na stronie.").waitFor({ timeout: 20000 });
  });
} catch {
  /* zapisane */
} finally {
  await przegladarka.close();
  const raport = [`Test kreatora strony akcji na ${adres}`, ...wyniki].join("\n");
  fs.writeFileSync(path.join(katalog, "wynik.txt"), raport);
  console.log(raport);
  process.exit(wyniki.some((w) => w.startsWith("BLAD")) ? 1 : 0);
}
