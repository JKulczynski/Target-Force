// Audyt widoku mobilnego (29.10). Otwiera ekrany w rozmiarze telefonu (390 px, isMobile) i dla kazdego:
// zrzut + szerokosc dokumentu vs ekran + lista elementow wystajacych poza ekran (to one powoduja,
// ze telefon oddala cala strone i widac "zminiaturyzowany desktop").
//
// Uzycie:
//   node scripts/audyt-mobile.mjs <katalog_na_zrzuty> <plik_z_haslem> [adres=https://getwinover.com]
// Konto jak w e2e-sciezka-klienta.mjs (E2E_EMAIL). Kod wyjscia 1, gdy ktorykolwiek ekran jest za szeroki.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "C:/Users/kulcz/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright",
);
const [katalog, plikHasla, adres = "https://getwinover.com"] = process.argv.slice(2);
if (!katalog || !plikHasla) {
  console.error("Uzycie: node scripts/audyt-mobile.mjs <katalog> <plik_z_haslem> [adres]");
  process.exit(2);
}
fs.mkdirSync(katalog, { recursive: true });
const EMAIL = process.env.E2E_EMAIL ?? "kulczynski.jan.tomasz+tfpodglad@gmail.com";
const haslo = fs.readFileSync(plikHasla, "utf8").trim();

const przegladarka = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXE ?? "C:/Users/kulcz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
});
const kontekst = await przegladarka.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "pl-PL",
});
await kontekst.addCookies([{ name: "tf_lang", value: "pl", url: adres }]);
const s = await kontekst.newPage();

let zaSzerokie = 0;
async function zbadaj(nazwa, url) {
  await s.goto(url, { waitUntil: "load" });
  await s.waitForTimeout(1500);
  const wynik = await s.evaluate(() => {
    const ekran = document.documentElement.clientWidth;
    const szer = document.documentElement.scrollWidth;
    const winni = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= ekran + 1) continue;
      // tylko najwyzszy wystajacy element w galezi (rodzic nie wystaje)
      const rodzic = el.parentElement?.getBoundingClientRect();
      if (rodzic && rodzic.right > ekran + 1) continue;
      const klasa = typeof el.className === "string" ? el.className.slice(0, 90) : "";
      winni.push(`${el.tagName.toLowerCase()} right=${Math.round(r.right)} "${klasa}" ${(el.textContent ?? "").trim().slice(0, 40)}`);
    }
    return { ekran, szer, winni: winni.slice(0, 12) };
  });
  await s.screenshot({ path: path.join(katalog, `${nazwa}.png`) });
  const ok = wynik.szer <= wynik.ekran + 1;
  if (!ok) zaSzerokie += 1;
  console.log(`${ok ? "OK   " : "ZA SZEROKIE"} ${nazwa}: dokument ${wynik.szer}px / ekran ${wynik.ekran}px`);
  for (const w of wynik.winni) console.log(`        ${w}`);
}

await zbadaj("01-login", `${adres}/login`);
await s.fill("input[name=email]", EMAIL);
await s.fill("input[name=password]", haslo);
await Promise.all([s.waitForURL((u) => !u.toString().includes("/login"), { timeout: 30000 }), s.click('button:has-text("Zaloguj")')]).catch(async (e) => {
  await s.screenshot({ path: path.join(katalog, "01-login-blad.png") });
  throw e;
});

await zbadaj("02-kampanie", `${adres}/`);
const kampania = await s.locator('a[href^="/kampanie/"]:not([href="/kampanie/nowa"])').first().getAttribute("href").catch(() => null);
await zbadaj("03-kreator", `${adres}/kampanie/nowa`);
await zbadaj("04-zrodla", `${adres}/zrodla`);
await zbadaj("05-ustawienia", `${adres}/ustawienia`);
if (kampania) {
  const id = kampania.split("/")[2];
  await zbadaj("06-kampania", `${adres}/kampanie/${id}`);
  await zbadaj("07-kampania-strona", `${adres}/kampanie/${id}/strona`);
  await zbadaj("07b-raport", `${adres}/kampanie/${id}/raport`);
} else console.log("BRAK kampanii na koncie: pomijam ekran kampanii");
await zbadaj("08-strona-akcji", `${adres}/a/jasne-przejscia-bialoleka`);

await przegladarka.close();
console.log(zaSzerokie ? `\nZa szerokich ekranow: ${zaSzerokie}` : "\nWszystkie ekrany mieszcza sie w telefonie");
process.exit(zaSzerokie ? 1 : 0);
