@AGENTS.md

# Stan projektu i zasady pracy (Jan, 07.10.2026)

- Stan, decyzje i powody: `C:\Users\kulcz\Vault\02_PROJEKTY\piotr\TargetForce\_log.md` (najnowsze na gorze). Kolejka: `_todo.md`. Wizja: `CLAUDE.md` w tym katalogu Vault. Przeczytaj ostatnie 3-5 wpisow logu przed pierwsza zmiana w kodzie.
- Po kazdym zamknietym etapie (merge, deploy, decyzja, funkcja) dopisz wpis z data i godzina NA GORZE `_log.md`, z decyzjami i powodami (co wybrano, co odrzucono, dlaczego). Odhacz punkty w `_todo.md`. Inne sesje Claude czytaja stan z tego logu.
- Po pushu na main sprawdz stan deployu w Vercelu (nie tylko odpowiedz strony): 07.10 trzy deploye padly cicho na npm install.
- Baza: kazda zmiana schematu = plik w `supabase/migrations/` + apply na produkcji. Nic nie testujemy na prawdziwych decydentach (kampanie testowe: "Test 2", strona akcji /a/test-2 wylaczona).
- Zero dlugiego myslnika (U+2014) w kodzie, tekstach i commitach. Interfejs po polsku (wersja EN z przelacznikiem planowana po demo 08.10).
