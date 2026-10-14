// Test sciezki mieszkanca (wysylka w imieniu mieszkanca, 12.10): strona akcji bez logowania -> podpis ->
// "Wyslij" -> link potwierdzenia (w trybie probnym zwracany na stronie) -> "Potwierdzam i wysylam" ->
// "Adresat mi odpisal" -> panel tworcy akcji (konto Organizacji testowej) widzi status "wyslane", bez e-maila.
// Wymaga kampanii testowej z wlaczona strona akcji (slug ponizej). Dziala w trybie probnym i z prawdziwym Resend:
// mieszkancy maja adresy testowe Resend (delivered+...@resend.dev), dla nich serwer zwraca link potwierdzenia.
// Odbiorca kampanii testowej tez musi byc adresem @resend.dev (14.10: delivered@resend.dev).
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
const znak = Date.now();
const emailAnny = `delivered+anna-${znak}@resend.dev`;
const emailBartka = `delivered+bartek-${znak}@resend.dev`;
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
    await s.getByLabel("E-mail").fill(emailAnny);
    await s.getByText("Zgadzam się na przetwarzanie podanych danych").click();
    await s.getByRole("button", { name: "Przygotuj moją wiadomość" }).click();
    await s.getByRole("button", { name: "Wyślij", exact: true }).waitFor({ timeout: 20000 });
  });

  await krok("wyslij", async () => {
    await s.getByRole("button", { name: "Wyślij", exact: true }).click();
    await s.getByText("Sprawdź skrzynkę i potwierdź").waitFor({ timeout: 20000 });
    link = await s.locator("[data-link-probny]").getAttribute("href");
    if (!link) throw new Error("brak linku potwierdzenia (adres mieszkanca musi byc @resend.dev)");
  });

  await krok("potwierdzenie", async () => {
    await s.goto(link, { waitUntil: "load" });
    await s.getByRole("button", { name: "Potwierdzam i wysyłam" }).click();
    await s.getByText("Wiadomość wysłana.").waitFor({ timeout: 20000 });
  });

  await krok("adresat-odpisal", async () => {
    await s.getByRole("button", { name: "Tak, odpowiedział(a) w sprawie" }).click();
    await s.getByText("Dziękujemy, zapisaliśmy, że adresat odpisał.").waitFor({ timeout: 15000 });
  });

  let linkPolecenia = null;
  await krok("link-polecenia", async () => {
    linkPolecenia = await s.getByText("Wróć do strony akcji i udostępnij ją dalej").getAttribute("href");
    if (!linkPolecenia?.includes("?od=")) throw new Error(`brak kodu polecenia w linku: ${linkPolecenia}`);
  });

  let linkBartka = null;
  await krok("drugi-mieszkaniec-z-polecenia", async () => {
    const b = await kontekst.newPage();
    await b.goto(`${adres}${linkPolecenia}`, { waitUntil: "load" });
    await b.getByLabel("Imię").fill("Bartek");
    await b.getByLabel("Nazwisko").fill("Polecony");
    const gmina = b.getByRole("combobox");
    await gmina.click();
    await gmina.fill("Krak");
    await b.getByRole("option").first().click();
    await b.getByLabel("E-mail").fill(emailBartka);
    await b.getByText("Chcę dostać wiadomość, co dała ta akcja.").click();
    await b.getByText("Zgadzam się na przetwarzanie podanych danych").click();
    await b.getByRole("button", { name: "Przygotuj moją wiadomość" }).click();
    await b.getByRole("button", { name: "Wyślij", exact: true }).click();
    linkBartka = await b.locator("[data-link-probny]").getAttribute("href");
    await b.goto(linkBartka, { waitUntil: "load" });
    await b.getByRole("button", { name: "Potwierdzam i wysyłam" }).click();
    await b.getByText("Wiadomość wysłana.").waitFor({ timeout: 20000 });
    await b.close();
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
      if (tekst.includes(emailAnny)) throw new Error("e-mail widoczny bez zgody");
      if (!/facebook/.test(tekst)) throw new Error("brak zrodla wejscia");
      const bartek = await tworca.locator("tr", { hasText: "Bartek Polecony" }).first().innerText();
      if (!bartek.includes(emailBartka)) throw new Error("e-mail ze zgoda niewidoczny");
      await tworca.getByText(/Z poleceń \(link „zaproś znajomych”\): [1-9]/).waitFor({ timeout: 10000 });
      await tworca.getByText(/Anna Testowa.*: [1-9]/).first().waitFor();
      await tworca.locator("#akcja").scrollIntoViewIfNeeded();
    },
    tworca,
  );

  await krok(
    "eksport-csv",
    async () => {
      const [pobranie] = await Promise.all([tworca.waitForEvent("download"), tworca.getByRole("button", { name: "Pobierz listę (CSV)" }).click()]);
      const plik = path.join(katalog, "eksport.csv");
      await pobranie.saveAs(plik);
      const csv = fs.readFileSync(plik, "utf8");
      if (!csv.includes("Anna;Testowa") || !csv.includes(emailBartka)) throw new Error("CSV bez danych");
      if (csv.includes(emailAnny)) throw new Error("CSV zawiera e-mail bez zgody");
    },
    tworca,
  );

  await krok(
    "mail-do-sympatykow",
    async () => {
      tworca.on("dialog", (d) => d.accept());
      await tworca.getByPlaceholder("np. Poseł odpowiedział. Co dalej?").fill("Test automatu: co dalej");
      await tworca.getByPlaceholder(/Dzień dobry \{imie\}/).fill("Dzień dobry {imie}, to wiadomość testowa automatu WinOver.");
      await tworca.getByRole("button", { name: /Wyślij do \d+ osób/ }).click();
      await tworca.getByText(/Tryb próbny: przygotowano \d+ maili|Wysłano do \d+ osób/).waitFor({ timeout: 20000 });
    },
    tworca,
  );

  await krok("wypisanie", async () => {
    await s.goto(`${linkBartka}?wypisz=1`, { waitUntil: "load" });
    await s.getByRole("button", { name: "Nie chcę więcej wiadomości od organizatora" }).click();
    await s.getByText(/Wypisaliśmy Cię/).waitFor({ timeout: 15000 });
  });

  await krok(
    "po-wypisaniu-brak-emaila",
    async () => {
      await tworca.reload({ waitUntil: "load" });
      const bartek = tworca.locator("tr", { hasText: "Bartek Polecony" }).first();
      await bartek.waitFor({ timeout: 20000 });
      if ((await bartek.innerText()).includes(emailBartka)) throw new Error("e-mail widoczny po wypisaniu");
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
