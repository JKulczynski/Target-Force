// Test calej sciezki klienta WinOver (blok D, 12.10). Uruchamia prawdziwa przegladarke na wskazanym adresie,
// loguje sie kontem z "Organizacji testowej" (zwykly klient, nie administrator) i przechodzi:
// lista -> blokada panelu admina -> kreator z szablonu -> oswiadczenie (automatyczna akceptacja) -> petycja -> raport -> regulamin.
// Nic nie wysyla do decydentow (bez skrzynki nie da sie). Na koncu usuwa kampanie testowa.
//
// Uzycie:
//   node scripts/e2e-sciezka-klienta.mjs <katalog_na_zrzuty> <plik_z_haslem> [adres=https://target-force.vercel.app]
// Wymaga Playwrighta (globalnie: npm i -g @playwright/cli) i Chromium z ms-playwright. Sciezki ponizej mozna nadpisac:
//   PLAYWRIGHT_MODULE, CHROMIUM_EXE, E2E_EMAIL.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "C:/Users/kulcz/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright",
);
const [katalog, plikHasla, adres = "https://target-force.vercel.app"] = process.argv.slice(2);
if (!katalog || !plikHasla) {
  console.error("Uzycie: node scripts/e2e-sciezka-klienta.mjs <katalog> <plik_z_haslem> [adres]");
  process.exit(2);
}
fs.mkdirSync(katalog, { recursive: true });
const EMAIL = process.env.E2E_EMAIL ?? "kulczynski.jan.tomasz+tfpodglad@gmail.com";
const haslo = fs.readFileSync(plikHasla, "utf8").trim();
const znacznik = new Date().toISOString().slice(0, 16).replace("T", " ");
const wyniki = [];
let nr = 0;

const przegladarka = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXE ?? "C:/Users/kulcz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
});
const kontekst = await przegladarka.newContext({ viewport: { width: 1280, height: 900 }, locale: "pl-PL" });
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

let idKampanii = null;
try {
  await krok("logowanie", async () => {
    await s.goto(`${adres}/login`, { waitUntil: "load" });
    if (await s.getByText("Nowe konto").count()) throw new Error("widac przelacznik rejestracji");
    await s.fill("input[name=email]", EMAIL);
    await s.fill("input[name=password]", haslo);
    await Promise.all([s.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 }), s.click('button:has-text("Zaloguj")')]);
  });

  await krok("lista-kampanii", async () => {
    await s.getByRole("heading", { name: "Kampanie" }).waitFor({ timeout: 20000 });
    await s.waitForTimeout(1500);
    if (await s.getByText("Administracja", { exact: true }).count()) throw new Error("klient widzi link Administracja");
  });

  await krok("admin-zablokowany", async () => {
    await s.goto(`${adres}/admin`, { waitUntil: "load" });
    await s.getByText("To może zrobić tylko administrator WinOver.").waitFor({ timeout: 15000 });
  });

  await krok("kreator-krok1", async () => {
    await s.goto(`${adres}/kampanie/nowa`, { waitUntil: "load" });
    await s.getByRole("button", { name: /Interwencja lokalna/ }).click();
    await s.getByPlaceholder("np. Pokaz filmu, Holandia, październik").fill(`Test automatu ${znacznik}`);
    await s
      .getByPlaceholder(/zaprosić na pokaz filmu/)
      .fill("Gmina ma przywrócić nocne oświetlenie przejść dla pieszych przy szkołach. Prosimy radnych i wójta o decyzję w budżecie na 2027.");
    await s.getByPlaceholder("np. reżyser filmu, fundacja X").fill("Fundacja Testowa (automat)");
  });

  await krok("kreator-krok2", async () => {
    await s.getByRole("button", { name: "Dalej" }).click();
    await s.getByText("Kto ma wpływ na decydenta").or(s.getByText("Decydenci", { exact: false })).first().waitFor({ timeout: 15000 });
  });

  await krok("kreator-zapis", async () => {
    await s.getByRole("button", { name: "Dalej" }).click();
    await s.getByRole("button", { name: "Zapisz kampanię" }).click();
    await s.waitForURL(/\/kampanie\/[0-9a-f-]{36}$/, { timeout: 30000 });
    idKampanii = s.url().split("/").pop();
    await s.locator("#zleca").getByText("Kto zleca").first().waitFor({ timeout: 20000 });
  });

  await krok("oswiadczenie-auto-akceptacja", async () => {
    const sekcja = s.locator("#zleca");
    await sekcja.getByLabel("Zleceniodawca (organizacja albo osoba)").fill("Fundacja Testowa (automat)");
    await sekcja.getByLabel("Osoba odpowiedzialna").fill("Jan Testowy");
    await sekcja.getByLabel("E-mail tej osoby").fill("test@example.com");
    for (const pole of await sekcja.locator('input[type="checkbox"]').all()) {
      const opis = (await pole.locator("xpath=..").innerText()).trim();
      // Dwa pytania o ryzyko zostawiamy na "nie", zeby kampania byla "poza zakresem" i zaakceptowala sie sama.
      if (/siedzibę poza Unią|opłacana przez podmiot trzeci/.test(opis)) continue;
      await pole.check();
    }
    await sekcja.getByRole("button", { name: "Składam oświadczenie" }).click();
    await sekcja.getByText("Zaakceptowana", { exact: true }).waitFor({ timeout: 20000 });
    await sekcja.getByText("Poza zakresem szczególnych obowiązków", { exact: true }).first().waitFor({ timeout: 5000 });
  });

  await krok("petycja", async () => {
    const sekcja = s.locator("#pismo");
    await sekcja.getByText("Petycja (ustawa z 11 lipca 2014 r. o petycjach)").click();
    await sekcja.getByLabel("Wnoszący (organizacja albo osoba)").fill("Fundacja Testowa (automat)");
    await sekcja.getByLabel("Adres do korespondencji (siedziba)").fill("ul. Testowa 1, 00-001 Warszawa");
    await sekcja.getByRole("button", { name: "Zapisz formę pisma" }).click();
    await sekcja.getByText("Zapisano.").waitFor({ timeout: 15000 });
  });

  await krok("raport-zgodnosc", async () => {
    await s.goto(`${adres}/kampanie/${idKampanii}/raport`, { waitUntil: "load" });
    await s.getByRole("heading", { name: "Zgodność" }).waitFor({ timeout: 15000 });
    await s.getByText("Pobierz pakiet zgodności (JSON)").waitFor();
  });

  await krok("pakiet-json", async () => {
    const odp = await s.request.get(`${adres}/api/kampanie/${idKampanii}/oswiadczenie/pakiet`);
    const j = await odp.json();
    if (j.decyzjaZespolu?.zgoda !== "zaakceptowana") throw new Error(`pakiet: zgoda=${j.decyzjaZespolu?.zgoda}`);
    if (!j.oswiadczenia?.[0]?.ip) throw new Error("pakiet bez IP oswiadczenia");
  });

  await krok("zacznij-tutaj", async () => {
    await s.goto(`${adres}/`, { waitUntil: "load" });
    await s.getByText("Zacznij tutaj").waitFor({ timeout: 15000 });
  });

  await krok("regulamin", async () => {
    await s.goto(`${adres}/regulamin`, { waitUntil: "load" });
    await s.getByRole("heading", { name: "Regulamin WinOver" }).waitFor();
  });

  await krok("sprzatanie", async () => {
    // Kampania testowa nie zostaje w bazie: usuwamy ją tym samym przyciskiem, którego używa klient.
    s.on("dialog", (d) => d.accept());
    await s.goto(`${adres}/kampanie/${idKampanii}`, { waitUntil: "load" });
    await s.getByRole("button", { name: "Usuń kampanię" }).click();
    await s.waitForURL((u) => !u.toString().includes(idKampanii), { timeout: 20000 });
    idKampanii = `${idKampanii} (usunieta)`;
  });
} catch {
  /* wynik kroku juz zapisany */
} finally {
  await przegladarka.close();
  const raport = [`Test sciezki klienta ${znacznik} na ${adres}`, `Kampania testowa: ${idKampanii ?? "nie powstala"}`, ...wyniki].join("\n");
  fs.writeFileSync(path.join(katalog, "wynik.txt"), raport);
  console.log(raport);
  process.exit(wyniki.some((w) => w.startsWith("BLAD")) ? 1 : 0);
}
