// Test sciezki mieszkanca (wysylka w imieniu mieszkanca, 12.10): strona akcji bez logowania -> podpis ->
// "Wyslij" -> link potwierdzenia (w trybie probnym zwracany na stronie) -> "Potwierdzam i wysylam" ->
// "Adresat mi odpisal" -> panel tworcy akcji (konto Organizacji testowej) widzi status "wyslane", bez e-maila.
// Wymaga kampanii testowej z wlaczona strona akcji (slug ponizej) i trybu probnego (bez RESEND_API_KEY).
//
// Uzycie: node scripts/e2e-sciezka-mieszkanca.mjs <katalog> <plik_z_haslem> <id_kampanii> [slug] [adres]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "C:/Users/kulcz/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright",
);
const [katalog, plikHasla, idKampanii, slug = "test-mieszkanca-automat", adres = "https://target-force.vercel.app"] =
  process.argv.slice(2);
if (!katalog || !plikHasla || !idKampanii) {
  console.error("Uzycie: node scripts/e2e-sciezka-mieszkanca.mjs <katalog> <plik_z_haslem> <id_kampanii> [slug] [adres]");
  process.exit(2);
}
fs.mkdirSync(katalog, { recursive: true });
const haslo = fs.readFileSync(plikHasla, "utf8").trim();
const wyniki = [];
let nr = 0;

const przegladarka = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXE ?? "C:/Users/kulcz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
});
// Mieszkaniec na telefonie: tak wejdzie większość ludzi.
const kontekst = await przegladarka.newContext({ viewport: { width: 390, height: 844 }, locale: "pl-PL", isMobile: true, hasTouch: true });
await kontekst.addCookies([{ name: "tf_lang", value: "pl", url: adres }]);
const s = await kontekst.newPage();

async function krok(nazwa, fn, strona = s) {
  nr += 1;
  const plik = path.join(katalog, `${String(nr).padStart(2, "0")}-${nazwa}.png`);
  try {
    await fn();
    await strona.screenshot({ path: plik, fullPage: true });
    wyniki.push(`OK    ${nr}. ${nazwa}`);
  } catch (e) {
    await strona.screenshot({ path: plik, fullPage: true }).catch(() => {});
    wyniki.push(`BLAD  ${nr}. ${nazwa}: ${e.message.split("\n")[0]}`);
    throw e;
  }
}

let link = null;
try {
  await krok("strona-akcji", async () => {
    await s.goto(`${adres}/a/${slug}?utm_source=facebook&utm_medium=reklama`, { waitUntil: "load" });
    await s.getByText("Test: oświetlenie przejść przy szkołach").first().waitFor({ timeout: 20000 });
  });

  await krok("formularz", async () => {
    await s.getByLabel("Imię").fill("Anna");
    await s.getByLabel("Nazwisko").fill("Testowa");
    const gmina = s.getByRole("combobox");
    await gmina.click();
    await gmina.fill("Krak");
    await s.getByRole("option").first().click();
    await s.getByLabel("E-mail").fill("anna.testowa@example.com");
    await s.getByText("Zgadzam się na przetwarzanie podanych danych").click();
    await s.getByRole("button", { name: "Przygotuj moją wiadomość" }).click();
    await s.getByRole("button", { name: "Wyślij", exact: true }).waitFor({ timeout: 20000 });
  });

  await krok("wyslij", async () => {
    await s.getByRole("button", { name: "Wyślij", exact: true }).click();
    await s.getByText("Sprawdź skrzynkę i potwierdź").waitFor({ timeout: 20000 });
    link = await s.locator("[data-link-probny]").getAttribute("href");
    if (!link) throw new Error("brak linku probnego (czy wlaczony jest prawdziwy Resend?)");
  });

  await krok("potwierdzenie", async () => {
    await s.goto(link, { waitUntil: "load" });
    await s.getByRole("button", { name: "Potwierdzam i wysyłam" }).click();
    await s.getByText("Wiadomość wysłana.").waitFor({ timeout: 20000 });
  });

  await krok("adresat-odpisal", async () => {
    await s.getByRole("button", { name: "Adresat mi odpisał" }).click();
    await s.getByText("Dziękujemy, zapisaliśmy, że adresat odpisał.").waitFor({ timeout: 15000 });
  });

  await krok("ponowne-otwarcie-linku", async () => {
    // Drugie kliknięcie w link z maila nie wysyła drugi raz.
    await s.goto(link, { waitUntil: "load" });
    await s.getByText("Wiadomość wysłana.").waitFor({ timeout: 15000 });
    if (await s.getByRole("button", { name: "Potwierdzam i wysyłam" }).count()) throw new Error("mozna wyslac drugi raz");
  });

  const tworca = await (await przegladarka.newContext({ viewport: { width: 1280, height: 900 }, locale: "pl-PL" })).newPage();
  await krok(
    "panel-tworcy",
    async () => {
      await tworca.context().addCookies([{ name: "tf_lang", value: "pl", url: adres }]);
      await tworca.goto(`${adres}/login`, { waitUntil: "load" });
      await tworca.fill("input[name=email]", process.env.E2E_EMAIL ?? "kulczynski.jan.tomasz+tfpodglad@gmail.com");
      await tworca.fill("input[name=password]", haslo);
      await Promise.all([
        tworca.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 }),
        tworca.click('button:has-text("Zaloguj")'),
      ]);
      await tworca.goto(`${adres}/kampanie/${idKampanii}#akcja`, { waitUntil: "load" });
      const wiersz = tworca.locator("tr", { hasText: "Anna Testowa" }).first();
      await wiersz.waitFor({ timeout: 20000 });
      const tekst = await wiersz.innerText();
      if (!/wysłane/.test(tekst)) throw new Error(`status w panelu: ${tekst}`);
      if (/adresat odpisał/.test(tekst) === false) throw new Error("brak 'adresat odpisal'");
      if (/anna\.testowa@example\.com/.test(tekst)) throw new Error("e-mail widoczny bez zgody");
      if (!/facebook/.test(tekst)) throw new Error("brak zrodla wejscia");
      await tworca.locator("#akcja").scrollIntoViewIfNeeded();
    },
    tworca,
  );
} catch {
  /* zapisane */
} finally {
  await przegladarka.close();
  const raport = [`Test sciezki mieszkanca na ${adres}/a/${slug}`, ...wyniki].join("\n");
  fs.writeFileSync(path.join(katalog, "wynik.txt"), raport);
  console.log(raport);
  process.exit(wyniki.some((w) => w.startsWith("BLAD")) ? 1 : 0);
}
