# Target Force

Narzedzie do prospectingu: listy kontaktow (decydenci publiczni i B2B), psychografia
odbiorcow, generowanie wariantow wiadomosci, wysylka i analityka. **Kampania jest
pojemnikiem na wszystko:** wybierasz zrodla, opisujesz kogo szukasz i co chcesz osiagnac,
reszta powstaje z tych odpowiedzi.

Projekt dla Piotra. Zakres MVP i ustalenia handlowe:
`Vault/02_PROJEKTY/piotr/TargetForce/zakres-mvp-2026-09-24.md`.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Hosting: Vercel
- Baza: Supabase (**jeszcze niepodpieta**, patrz nizej)

## Co gdzie lezy

```
app/
  page.tsx               lista kampanii + "Dodaj kampanie"
  kampanie/nowa/         formularz parametrow kampanii
  kampanie/[id]/         szczegoly kampanii i postep
  zrodla/                przeglad zrodel kontaktow
lib/
  types.ts               model danych i katalog zrodel
  store.ts               warstwa danych (dzis localStorage, docelowo Supabase)
```

## Stan na 24.09.2026

**Dziala:** caly przeplyw klikania. Dodajesz kampanie, ustawiasz parametry, widzisz ja
na liscie, wchodzisz w szczegoly, zmieniasz status.

**Nie dziala jeszcze, w tej kolejnosci:** pobieranie kontaktow ze zrodel, psychografia,
generowanie wiadomosci, wysylka i follow-upy, analityka.

**Ograniczenie do zdjecia jako pierwsze:** `lib/store.ts` trzyma kampanie w przegladarce
(`localStorage`). Dane nie przechodza miedzy urzadzeniami ani miedzy ludzmi. To swiadomy
skrot, zeby dalo sie klikac przez caly przeplyw bez czekania na baze. **Podmiana dotyczy
wylacznie tego jednego pliku**, reszta aplikacji o zrodle danych nie wie.

## Zrodla kontaktow

Trzy sprawdzone 24.09.2026, wszystkie odpowiedzialy poprawnymi danymi, bez klucza
i bez rejestracji:

| Zrodlo | Endpoint | Uwagi |
|---|---|---|
| Sejm RP | `api.sejm.gov.pl/sejm/term10/MP` | **Zwraca adresy e-mail**, klub, okreg |
| Parlament Europejski | `data.europarl.europa.eu/api/v2/meps` | JSON-LD, paginacja |
| Tweede Kamer (NL) | `gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Persoon` | OData v4 |

Apollo i Clay wymagaja kluczy API.

**To jest istotne dla wyceny:** na spotkaniu 22.09 zalozono, ze bazy trzeba budowac
recznie. Nieprawda, to sa integracje z otwartymi API.

## Uruchomienie lokalne

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```

## Do rozstrzygniecia

- **Wysylka i follow-upy nie mieszcza sie w modelu serverless.** To procesy dlugie
  i cykliczne. Najprostsze wyjscie bez nowej infrastruktury: kolejka w Supabase plus
  zadanie cykliczne. Decyzja przed pisaniem wysylki, nie w trakcie.
- **Wykrywanie odpowiedzi** wymaga czytania skrzynki. Osobny kawalek, latwy do
  przeoczenia przy wycenie.
- **Wlasnosc kodu i licencja nieustalone** (pytanie do Piotra z 24.09). Dlatego repo stoi
  na koncie osobistym Jana, a nie w organizacji.
