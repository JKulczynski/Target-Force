# WinOver (dawniej Target Force)

Kampanie do decydentow od celu do raportu wplywu: opisujesz sprawe, AI pisze warianty wiadomosci
z psychografia grupy odbiorcow, nadawca je zatwierdza, wysylka idzie partiami z jego skrzynki,
przypomnienia w tym samym watku, klikniecia i odpowiedzi sa liczone, klient dostaje raport.
Do tego strona akcji, na ktorej mieszkancy pisza do swoich poslow z wlasnej poczty.

Projekt dla Piotra (agencja). Stan, decyzje i kolejka: `Vault/02_PROJEKTY/piotr/WinOver/_log.md`
i `_todo.md`. Charakter produktu: `PRODUCT.md`. Produkcja: https://target-force.vercel.app

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind v4. Hosting Vercel (Node 24, cron).
- Supabase: Postgres + Auth. Schemat w `supabase/migrations/` (baseline z 07.10.2026 + kolejne pliki).
  Kazda zmiana bazy = nowy plik migracji; na produkcje przez MCP `apply_migration` albo CLI.
- Claude (Anthropic SDK): generowanie wiadomosci (Opus) i propozycja odbiorcow (Sonnet).
- nodemailer (SMTP nadawcy), imapflow (odpowiedzi z IMAP).

## Przeplyw w aplikacji

1. `kampanie/nowa`: kreator w 3 krokach (szablony z `lib/szablony.ts`, zrodla z licznikiem,
   "Zaproponuj na podstawie celu", moment wysylki z kalendarza Sejmu).
2. `kampanie/[id]`: brief, Wiadomosci (generowanie + zatwierdzanie + kontrola), Skrzynka nadawcy,
   Wysylka (lista odbiorcow z zawezeniem, test, partie, przypomnienia, automat), Odbiorcy (status,
   "Sprawdz odpowiedzi w skrzynce"), Wplyw (wydarzenia + interpelacje z API Sejmu), Strona akcji.
3. `kampanie/[id]/raport`: raport dla klienta (PDF przez druk).
4. `a/[slug]`: publiczna strona akcji (bez logowania, bez paska aplikacji).

## Co gdzie lezy

```
app/
  api/akcja/[slug]/        podpis ze strony akcji (klient serwisowy), zdarzenia otwarto/udostepnil
  api/akcja/gminy          lista gmin z okregiem do wyszukiwarki
  api/cron/wysylka         automat wysylki (dni robocze 6:30 UTC), CRON_SECRET
  api/cron/odpowiedzi      automat odpowiedzi IMAP (dni robocze 6:00 UTC)
  api/kampanie/[id]/       generuj (rola nadawca | sympatyk), wysylka, odbiorcy, odpowiedzi, interpelacje
  api/kampanie/propozycja  AI: zrodla i komisje z celu kampanii
  api/sejm/posiedzenia     najblizsze posiedzenia Sejmu
  api/zespol, api/skrzynka, api/domena, api/zrodla/[id], api/komisje-sejmu
  r/[id]/[nr]              krotki link sledzacy z maila
  w/[kod]                  wypisanie odbiorcy (List-Unsubscribe)
  auth/callback, auth/haslo (zaproszenie i odzyskiwanie hasla), login
components/   Wiadomosci, Wysylka, Odbiorcy, Wplyw, StronaAkcji, AkcjaFormularz, SkrzynkaKampanii,
              Zespol, MomentSejmu, ui.ts (wspolne klasy)
lib/
  store.ts            warstwa danych w przegladarce (Supabase + RLS zespolu), tlumaczenie snake_case <-> camelCase
  types.ts            model kampanii, katalog zrodel
  zrodla-serwer.ts    pobieranie kontaktow z API (Sejm, PE, Tweede Kamer, samorzady, ministerstwa)
  odbiorcy-serwer.ts  budowanie listy odbiorcow z zawezeniem
  wysylka-serwer.ts   silnik wysylki (partie, limit dzienny, rozgrzewanie, przypomnienia, linki sledzace)
  odpowiedzi-serwer.ts IMAP: kto odpisal (In-Reply-To -> Message-ID)
  personalizacja.ts   pola {imie} {nazwisko} {okreg} {wojewodztwo} {gmina}
  kontrola.ts         ostrzezenia przed zatwierdzeniem wiadomosci
  akcja.ts            strona akcji: gminy -> okreg (PKW 2023), slug, YouTube
  prompty/            warsztat pisania (pisanie.ts) i profile bazowe odbiorcow (odbiorcy.ts)
  dane/               jst.json (MSWiA), okregi.json (TERYT -> okreg), ministerstwa.json
  supabase/           client (przegladarka), server (sesja), admin (klucz serwisowy), proxy (sesja + sciezki publiczne)
supabase/migrations/  schemat bazy
tests/                vitest, czyste funkcje
```

## Dostep i bezpieczenstwo

- Organizacje (od 12.10): kazdy klient widzi tylko swoje dane. Tabele `organizacje` i `czlonkowie`, polityki RLS po `czy_dostep_org()` i `czy_dostep_kampania()`.
- Administratorzy WinOver (Jan, Piotr) = tabela `zespol`: widza wszystkie organizacje, panel `/admin`, decyzje o oswiadczeniach.
- Oswiadczenie zleceniodawcy: kampanie "poza zakresem" akceptuje automat, reszta czeka na administratora. Straznik w bazie (`straznik_kampanii`) nie pozwala klientowi zaakceptowac samego siebie.
- Klucz serwisowy (`SUPABASE_SERVICE_ROLE_KEY`) tylko na serwerze: cron, zaproszenia, panel admina, automatyczna akceptacja, strona akcji.
- Hasla SMTP szyfrowane AES-256-GCM kluczem `TF_KLUCZ_SZYFROWANIA`, odczyt tylko przez funkcje bazy po sprawdzeniu organizacji.
- Konta tylko z zaproszenia (rejestracja wylaczona w Supabase Auth).
- Wylacznik wszystkich wysylek: `WYSYLKA_WSTRZYMANA=1` w zmiennych Vercel.
- Sciezki publiczne (proxy): `/login`, `/auth`, `/r/`, `/w/`, `/a/` (tez `?osadzona=1`), `/api/akcja/`, `/api/cron/`, `/regulamin`, `/prywatnosc`.

## Zmienne srodowiska

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`TF_KLUCZ_SZYFROWANIA` (32 bajty base64), `ANTHROPIC_API_KEY`, `CRON_SECRET`.
Lokalnie w `.env.local` (bez klucza serwisowego strona akcji i cron nie dzialaja).

## Praca lokalna

```
npm install
npm run dev
npm test          # vitest
npm run build     # lint + next build (to samo, co Vercel)
```

Test calej sciezki klienta w prawdziwej przegladarce (konto z "Organizacji testowej", zrzuty ekranu, na koncu usuwa kampanie testowa):

```
node scripts/e2e-sciezka-klienta.mjs <katalog_na_zrzuty> <plik_z_haslem> [adres]
```
