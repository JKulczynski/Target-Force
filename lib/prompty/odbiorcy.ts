import type { ZrodloId } from "@/lib/types";

/**
 * Psychografia grup odbiorców ("skill" dla generatora).
 * Źródła: research Jana z 06.10.2026 (17 tematów, Vault: 03_NARZEDZIA_I_SKILLE/wiedza/research-tf-skille/).
 * W nawiasach kwadratowych skrót źródła. [PL] = zmierzone w Polsce, [EU] = badanie obejmujące Polskę,
 * [przeniesione] = z USA/UK/DE, kierunek pewny, liczby nie. Zmieniaj tu, nie w route.
 */
export const METODA = `# Jak budujemy psychografię grupy odbiorców

Psychografia opisuje GRUPĘ (np. posłowie komisji zdrowia), nigdy konkretną osobę.
Zasady, bo modele językowe zmyślają profile ludzi i myślą "po amerykańsku" (Bisbee 2024: 48% wniosków z syntetycznych odpowiedzi różniło się od prawdziwych; Atari 2023: im dalej kulturowo od USA, tym gorzej):
- Każdy punkt profilu ma źródło w nawiasie: [profil bazowy] gdy wynika z profilu poniżej, [materiały] gdy z celu lub materiałów kampanii, [hipoteza] gdy to twój domysł.
- Hipotezy na końcu, osobno, i najwyżej dwie. Nie opisuj, co grupa "czuje" albo "myśli", bez źródła.
- Opisuj sytuację i motywy (co odbiorca chce osiągnąć, czego się boi), nie demografię.
- Sprawdź, czy nie przenosisz amerykańskich realiów: zbiórki pieniędzy na kampanię, okręgi jednomandatowe do Sejmu, słaba dyscyplina partyjna. W Polsce tak nie jest.
- Komplementy i obietnice nie są dowodem. Liczy się zachowanie: interpelacje, głosowania, wypowiedzi, uchwały.

Każdą wiadomość sprawdź czterema siłami (Moesta, JTBD):
1. Problem: czy nazywa konkretny, lokalny koszt zaniechania?
2. Korzyść: czy daje odbiorcy łatwą wygraną, którą może się pochwalić?
3. Lęk: czy zdejmuje ryzyko (podstawa prawna, precedens, brak kontrowersji)?
4. Nawyk: czy prosi o jeden mały, konkretny krok?
`;

const SEJM = `## Profil bazowy: posłowie na Sejm RP
Zadanie odbiorcy: "Gdy sprawa z mojego okręgu trafia do mediów albo do biura, chcę pokazać widoczne działanie, żeby wyborcy i partia widzieli mnie jako skutecznego."
Motywy:
- Reelekcja idzie dwoma kanałami: miejsce na liście (partia) i głosy preferencyjne w okręgu [PL: Gendźwiłł 2018; Carroll i Nalepa]. Głos na partię dominuje nad głosem na osobę.
- Dyscyplina partyjna jest silna. Posłowie z dużym poparciem osobistym wyłamują się tylko wtedy, gdy i tak nie zgadzają się z kierownictwem [PL: Carroll i Nalepa].
- Lubią działania, które mogą sobie przypisać: interwencja poselska, interpelacja, pytanie na komisji, spotkanie w biurze [przeniesione: Mayhew].
- Politycy źle oceniają, co myślą wyborcy, i zwykle przeceniają poparcie dla status quo [przeniesione: POLPOP, Broockman i Skovron]. Konkretne dane o poparciu są dla nich wartością.
- Ulegają tym samym skrótom myślowym co wszyscy: status quo, ramowanie, koszty utopione [przeniesione: Sheffer 2018].
Czego się boją: wejścia w konflikt z linią partii, kontrowersji, przyznania, że wcześniejsza decyzja była zła.
Kto czyta pierwszy: biuro poselskie, małe (kilka osób), przeciążone; ocenia w kilka sekund, czy sprawa dotyczy okręgu i czy nadawca jest prawdziwy [przeniesione: CMF; UK: Bolet i Campbell 2024].
Co działa:
- Okręg i liczba dotkniętych mieszkańców w pierwszych dwóch zdaniach.
- Jedna prośba w kompetencji posła. Interwencja poselska (art. 20 ustawy o wykonywaniu mandatu) obliguje instytucję do odpowiedzi w 14 dni [PL].
- Prośba zgodna z linią partii, ponadpartyjna albo lokalna. Nigdy na zimno "proszę zagłosować przeciw swojemu klubowi".
- Ramowanie jako ochrona przed stratą albo kontynuacja zobowiązania, nie ryzykowna nowość.
- Zaufane sygnały: kolega z klubu albo komisji, który już popiera; lokalna organizacja; własna wcześniejsza wypowiedź posła (tylko jeśli jest w materiałach).
- Moment: gdy temat jest na agendzie (projekt, komisja, budżet, wydarzenie) [przeniesione: Kingdon]. Bez okna politycznego celem jest zauważenie sprawy, nie decyzja.
Realne oczekiwania: pierwsza odpowiedź to często potwierdzenie albo prośba o dane, nie stanowisko.`;

const PARLAMENT_UE = `## Profil bazowy: posłowie do Parlamentu Europejskiego
Zadanie odbiorcy: "Gdy teczka mojej komisji idzie do głosowania, chcę wiedzieć, jak wpłynie na mój kraj i region, żeby zająć bezpieczne, uzasadnione stanowisko."
Motywy:
- Reelekcja z list otwartych w dużych okręgach; polscy europosłowie startują z 13 okręgów [EU].
- Liczy się etap procedury: sprawozdawca, kontrsprawozdawcy, komisja właściwa, głosowanie w komisji, trilog, plenarne.
Kto czyta pierwszy: asystent; około jedna trzecia odpowiedzi pochodzi od asystentów, około 28% to odpowiedzi merytoryczne [EU: De Vries, Dinas, Solaz, badanie we wszystkich krajach UE].
Czego się boją: masowych akcji (IT Parlamentu kwarantannowało masowe kampanie, np. 457 325 wiadomości w 2013), emocji zamiast faktów, bycia "botem" w oczach mediów [EU].
Co działa:
- W pierwszych dwóch zdaniach: kto pisze, skąd, której teczki dotyczy (nazwa, numer procedury, jeśli jest w materiałach) i jaka jest prośba.
- Jedno konkretne pytanie albo działanie powiązane z terminem głosowania lub poprawką.
- Fakty i niezależne źródła zamiast apeli.
- Do polskich europosłów po polsku, do pozostałych po angielsku.`;

const SAMORZADY = `## Profil bazowy: urzędy samorządowe (gminy, powiaty, województwa)
Zadanie odbiorcy: "Gdy przychodzi pismo, chcę je zakwalifikować, załatwić zgodnie z procedurą i w terminie, nie biorąc na siebie osobistego ryzyka."
Kto czyta: kancelaria urzędu (adres ogólny z BIP), potem właściwy wydział; wójt, burmistrz albo prezydent rzadko pierwszy.
Motywy i lęki:
- Osobista odpowiedzialność urzędnika, m.in. za naruszenie dyscypliny finansów publicznych [PL]; logika "administracji defensywnej" [przeniesione: Włochy].
- Działają w trybach i terminach. Pismo nazwane formalnie wchodzi do rejestru z terminem: gminy odpowiedziały na 94% wniosków o informację publiczną w badaniu Fundacji Batorego [PL]. Zwykłe maile do urzędów miast w Niemczech zostają bez odpowiedzi w około dwóch na trzy przypadki [przeniesione: Kohler i in. 2023].
- Urzędnicy chętniej odpowiadają mieszkańcom niż osobom z zewnątrz [przeniesione: Kohler i in. 2023].
- Wójt lub burmistrz jest wybierany bezpośrednio i myśli o mieszkańcach i lokalnej widoczności.
Co działa:
- W pierwszych dwóch zdaniach: nadawca jako ktoś stąd (mieszkaniec, lokalna firma, organizacja z adresem) i podstawa albo tryb, jeśli pasuje (wniosek, petycja z ustawy o petycjach, informacja publiczna).
- Zdjęcie ryzyka: to jest zgodne z prawem, inna gmina już tak zrobiła, istnieje przepis lub uchwała, na której można się oprzeć (tylko jeśli jest w materiałach).
- Jedna mała prośba w kompetencji gminy: przekazanie właściwej osobie, dokument, termin, spotkanie.
- Terminy ustawowe wyłącznie rzeczowo (14 dni informacja publiczna, miesiąc wniosek, 3 miesiące petycja), bez gróźb i zawstydzania.
- Pełny podpis: imię i nazwisko albo nazwa organizacji, adres, e-mail. Bez tego pismo formalne zostaje bez rozpatrzenia [PL].`;

const TWEEDE_KAMER = `## Profil bazowy: posłowie Tweede Kamer (Holandia)
Zadanie odbiorcy: "Gdy temat jest w mojej specjalizacji frakcji, chcę konkretnych faktów i jasnej prośby, żeby szybko zdecydować, czy coś z tym zrobić."
- System proporcjonalny, jeden okręg krajowy, silne frakcje; każdy poseł ma swoje teczki tematyczne (woordvoerder) [przeniesione: zasady ogólne, brak danych o mailach].
- Pisz do rzecznika frakcji od danego tematu, krótko i bezpośrednio, z jedną prośbą (pytanie pisemne, pytanie w debacie, poprawka, spotkanie).
- Holendrzy cenią konkret i bezpośredniość, nie znoszą patosu i przesadnej grzeczności.`;

const PROFILE: Partial<Record<ZrodloId, string>> = {
  sejm: SEJM,
  parlament_ue: PARLAMENT_UE,
  samorzady: SAMORZADY,
  tweede_kamer: TWEEDE_KAMER,
};

/** Metoda plus profile bazowe dla wybranych źródeł odbiorców. */
export function psychografiaDla(zrodla: ZrodloId[]): string {
  const profile = zrodla.map((z) => PROFILE[z]).filter(Boolean);
  return [METODA, ...profile].join("\n\n");
}
