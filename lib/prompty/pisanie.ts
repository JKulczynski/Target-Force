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

## Struktura wiadomości (pierwsza wiadomość)
1. Zwrot grzecznościowy właściwy dla kraju i funkcji, neutralny płciowo, bez imienia.
2. Otwarcie (1-2 zdania): kim jest nadawca i dlaczego pisze właśnie do tej osoby lub grupy. Najpierw odbiorca, potem sprawa.
3. Sedno (2-3 zdania): sprawa w prostych słowach, bez żargonu. Jeden najważniejszy fakt z materiałów kampanii.
4. Dlaczego to ważne dla odbiorcy (1-2 zdania): skutek dla okręgu, komisji, branży albo wyborców. Konkret, nie ogólnik.
5. Prośba (1 zdanie): jedna, konkretna, łatwa do spełnienia (obejrzeć film, odpowiedzieć, spotkać się na 15 minut, zająć stanowisko).
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
- Bez clickbaitu, wykrzykników, WIELKICH LITER, emotikon i słów typu "pilne", "ważne", "szokujące".
- Temat ma brzmieć jak od człowieka do człowieka, np. "Film o [sprawa] przed premierą 5 października".

## Przypomnienia
- 50-90 słów. Nawiązanie do poprzedniej wiadomości w jednym zdaniu.
- Nowy, mały element (inny fakt, termin, pytanie), nie powtórka.
- Zero presji i wyrzutów ("nie otrzymałem odpowiedzi"). Uprzejmie, krótko, ta sama prośba.

## Język i ton według kraju
- Polski: "Szanowni Państwo" przy grupie; przy pojedynczej osobie neutralnie, np. "Szanowna Pani Posłanko / Szanowny Panie Pośle" tylko gdy znana płeć, inaczej "Dzień dobry". Forma grzecznościowa, rzeczowo, bez urzędniczego nadęcia.
- Niderlandzki: "Geachte Kamerleden" lub "Geacht Kamerlid", forma "u". Holendrzy cenią bezpośredniość i konkret: krótko, bez przesadnej grzeczności i bez patosu.
- Angielski (PE): "Dear Member of the European Parliament". Prosto, uprzejmie, bez amerykańskiej egzaltacji.

## Zakazy (tekst ma nie brzmieć jak AI ani jak masowa akcja)
- Żadnych wymyślonych faktów, liczb, cytatów, badań, nazwisk. Tylko to, co jest w celu i materiałach.
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
