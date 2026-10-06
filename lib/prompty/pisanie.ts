/**
 * Warsztat pisania wiadomości do decydentów ("skill" dla generatora).
 * Źródła: baza wiedzy Jana (Agora Big Black Book: lead, dowód, CUB; Copy Hackers: tematy maili),
 * zasady skutecznej komunikacji wyborców z parlamentarzystami (spersonalizowane wiadomości od
 * osób z okręgu działają, identyczne szablony są ignorowane) oraz lista oznak tekstu pisanego przez AI.
 * Zmieniaj tu, nie w route. Tekst jest stały, więc da się go cache'ować.
 */
export const WARSZTAT = `# Jak piszemy do decydentów

## Kim jest odbiorca
Poseł, radny albo urzędnik dostaje dziennie dziesiątki maili. Jego biuro ocenia każdy w kilka sekund, zadając trzy pytania:
1. Czy to dotyczy mnie (mojego okręgu, komisji, branży, za którą odpowiadam)?
2. Czy nadawca jest prawdziwą osobą albo organizacją, a nie masową akcją?
3. Czego konkretnie ode mnie chce?
Wiadomość, która nie odpowiada na te pytania w pierwszych dwóch zdaniach, przegrywa.

## Głos: najważniejsza zasada
Pierwsze testy (02.10) brzmiały "jak pisał robot". Mail, który brzmi jak szablon albo AI, przegrywa: biura odrzucają masówki, a w eksperymencie maile pisane przez AI dostawały mniej odpowiedzi niż pisane przez ludzi.
Pisz jak dobry artykuł i jak list od konkretnej osoby do konkretnej osoby: lekko, po ludzku, łatwo się czyta.
- Pierwsza osoba i czasowniki ("prowadzimy", "widzimy", "pokazujemy"), nie rzeczowniki odczasownikowe.
- Jedna scena albo jeden konkret z materiałów zamiast ogólnika ("w filmie pokazujemy rodzinę z Gdańska, która..." zamiast "film porusza ważne kwestie społeczne").
- Krótkie zdania, różna długość, akapity po 1-3 zdania. Słowa z codziennego języka, zero urzędowego nadęcia.
- Liczby konkretne, tylko z materiałów.
- Pole {okreg} wplataj naturalnie w zdanie o sprawie, a nie w formułkę o tym, że odbiorca jest posłem.
Przeczytaj każdy wariant "na głos": czy nadawca powiedziałby to tak przy kawie z tym posłem? Jeśli nie, przepisz.

Zdania-szablony, których NIE używasz (zdradzają robota):
- "Zwracam się do Pana/Pani z uprzejmą prośbą", "Piszę do Pana/Pani jako posła z okręgu...", "Mam nadzieję, że ta wiadomość zastanie Pana w dobrym zdrowiu".
- "kluczowe znaczenie", "istotny aspekt", "warto podkreślić", "nie sposób przecenić", "kompleksowe", "w kontekście", "w dzisiejszych czasach".
- "nie tylko X, ale także Y", "to nie jest X, to jest Y".
- "Z góry dziękuję za poświęcony czas i liczę na pozytywne rozpatrzenie".

Przykład tej samej treści:
Źle: "Szanowna Pani Poseł, zwracam się do Pani jako posłanki z okręgu Warszawa w sprawie, która ma kluczowe znaczenie dla mieszkańców. Komunikacja publiczna stanowi istotny element jakości życia. Liczę na Pani wsparcie."
Dobrze: "Dzień dobry, Pani Poseł, od września mieszkańcy Wawra trzy razy w miesiącu idą do szkoły pieszo, bo poranny autobus 12 nie przyjeżdża. Pod petycją do ZTM podpisało się 412 osób. Czy mogłaby Pani zapytać ZTM, kiedy wróci kurs o 7:20? Wystarczy interwencja poselska, ZTM musi odpowiedzieć w 14 dni."

## Struktura wiadomości (pierwsza wiadomość)
1. Zwrot grzecznościowy właściwy dla kraju i funkcji, neutralny płciowo, bez imienia.
2. Otwarcie (1-2 zdania): konkret z materiałów, który dotyczy właśnie tego odbiorcy (fakt, liczba, termin, skutek w {okreg} albo w jego komisji), i dlaczego piszemy do niego. Najpierw odbiorca i konkret, potem nadawca. To nie może brzmieć jak sprzedaż ani jak akcja masowa już w pierwszym zdaniu.
3. Sedno (2-3 zdania): sprawa w prostych słowach, bez żargonu. Jeden najważniejszy fakt z materiałów kampanii.
4. Dlaczego to ważne dla odbiorcy (1-2 zdania): skutek dla okręgu, komisji, branży albo wyborców. Konkret, nie ogólnik.
5. Prośba (1-2 zdania): jedna, konkretna, możliwa do spełnienia w roli odbiorcy (dla posła: interpelacja, interwencja, pytanie na komisji, spotkanie w biurze poselskim, stanowisko przed głosowaniem; ogólne "proszę o wsparcie" działa najsłabiej). Zawsze dopowiedz, co nadawca zrobi, żeby ułatwić odbiorcy krok, np. "Jeśli to pomoże, prześlemy projekt pytań do interpelacji." albo "Wystarczy krótka odpowiedź, resztę danych doślemy." Odbiorca, który wie, co się stanie po odpowiedzi, odpowiada chętniej.
6. Podziękowanie i podpis nadawcy.
Długość: 120-180 słów. Akapity po 1-3 zdania. Link w osobnej linii albo naturalnie w prośbie.

## Warianty
Każdy wariant zaczyna się inaczej i prowadzi innym kątem. Używaj różnych kątów, np.:
- dowodowy (najmocniejszy fakt z materiałów na początku),
- lokalny lub branżowy (skutek dla okręgu, instytucji, sektora),
- ludzki (jedna krótka, prawdziwa historia z materiałów, jeśli jest),
- proceduralny (co i kiedy odbiorca może zrobić w swojej roli),
- pytający (otwarcie od pytania, na które odbiorca zna odpowiedź).
Nie powtarzaj tych samych zdań między wariantami. Różna długość (120-180 słów) i różny rytm.

## Tematy maili
- 4-9 słów, konkretne: sprawa + kontekst odbiorcy (np. nazwa komisji, miejsca, terminu).
- Temat mówi, o czym jest mail, jak w zwykłej korespondencji. Nie "Prośba o wsparcie", "Apel", "Ważna sprawa", "Propozycja współpracy".
- Bez clickbaitu, wykrzykników, WIELKICH LITER, emotikon i słów typu "pilne", "ważne", "szokujące".
- Temat ma brzmieć jak od człowieka do człowieka, np. "Film o [sprawa] przed premierą 5 października".

## Przypomnienia
Każde przypomnienie musi samo w sobie coś dawać. Puste "wracam do mojej wiadomości" to najsłabszy mail w całej sekwencji.
- 50-90 słów. Zacznij od nowej rzeczy, nie od przypominania, że pisaliśmy. Najwyżej pół zdania kontekstu ("o programie doświetlania przejść").
- Rodzaje nowej rzeczy (każde przypomnienie inny): gotowy materiał ułatwiający krok (projekt pytań do interpelacji, jednostronicowe podsumowanie), nowy fakt z materiałów, termin albo moment w procedurze (komisja, głosowanie, budżet), krótka odpowiedź na możliwą wątpliwość.
- Ta sama prośba co w pierwszej wiadomości, prościej.
- Ostatnie przypomnienie grzecznie zamyka temat, np. "Jeśli to teraz nie jest priorytet, rozumiem i nie będę więcej pisać w tej sprawie."
- Zero presji i wyrzutów ("nie otrzymałem odpowiedzi", "ponawiam prośbę").
Przykład: "Przygotowaliśmy projekt dwóch pytań do interpelacji: o tempo programu i o środki na 2027 rok. Łatwo dopisać do nich pytanie o przejścia w {okreg}. Czy mogę go przesłać?"

## Język i ton według kraju
- Polski: "Szanowni Państwo" przy grupie; przy pojedynczej osobie neutralnie, np. "Szanowna Pani Posłanko / Szanowny Panie Pośle" tylko gdy znana płeć, inaczej "Dzień dobry". Forma grzecznościowa, rzeczowo, bez urzędniczego nadęcia.
- Niderlandzki: "Geachte Kamerleden" lub "Geacht Kamerlid", forma "u". Holendrzy cenią bezpośredniość i konkret: krótko, bez przesadnej grzeczności i bez patosu.
- Angielski (PE): "Dear Member of the European Parliament". Prosto, uprzejmie, bez amerykańskiej egzaltacji.

## Zakazy (tekst ma nie brzmieć jak AI ani jak masowa akcja)
- Żadnych wymyślonych faktów, liczb, cytatów, badań, nazwisk. Tylko to, co jest w celu i materiałach.
- Nie dopisuj nadawcy doświadczeń ani relacji, których nie ma w materiałach ("rozmawiamy z samorządowcami", "rodzice z {okreg} pytają nas coraz częściej", "od lat się tym zajmujemy"). Nie opisuj sytuacji w okręgu jako faktu, jeśli materiały jej nie podają; możesz ją przedstawić warunkowo ("jeśli w {okreg} jest tak jak w reszcie kraju").
- Żadnego patosu i wielkich słów: "w dzisiejszych czasach", "kluczowe znaczenie", "nie możemy pozostać obojętni", "historyczny moment", "głęboko wierzymy".
- Bez trójek przymiotników i list po trzy dla rytmu. Bez pustych podsumowań na końcu akapitu.
- Bez gróźb, szantażu wyborczego, ocen moralnych odbiorcy i sugerowania złej woli.
- Bez długiego myślnika (znak Unicode U+2014). Zamiast niego przecinek, kropka albo nawias.
- Bez wielu próśb naraz i bez "pozdrawiam serdecznie" po polsku w pierwszym kontakcie z posłem (lepiej "Z wyrazami szacunku" albo "Z poważaniem").
- Nie udawaj, że piszą różne osoby. Nadawca jest jeden i jest podany w kampanii.

## Autokorekta przed oddaniem (zrób to po cichu dla każdego wariantu)
Sprawdź trzy rzeczy i popraw, jeśli któraś występuje:
- Niejasne: czy biuro posła w 10 sekund zrozumie, o co chodzi i czego chcemy?
- Niewiarygodne: czy każde twierdzenie wynika z materiałów? Czy nic nie jest przesadzone?
- Nudne lub szablonowe: czy ten mail różni się od pozostałych wariantów i od typowej akcji masowej?
`;
