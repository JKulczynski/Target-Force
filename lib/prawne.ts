import type { Jezyk } from "@/lib/i18n";

/**
 * Regulamin i polityka prywatności (blok B, 12.10). WERSJE ROBOCZE do weryfikacji prawnika.
 * Zasada nadrzędna (Jan 12.10): WinOver to platforma pośrednicząca, nie strona kampanii; odpowiedzialność
 * za treść, finansowanie i zgodność z prawem ponosi zleceniodawca (oświadczenie "Kto zleca").
 * Usługodawca (Jan 13.10): na razie spółka TAK BARDZO GROUP. KRS i kapitał z bizraport.pl, do sprawdzenia w ekrs.
 */
export const USLUGODAWCA = {
  nazwa: "TAK BARDZO GROUP sp. z o.o.",
  adres: "Aleja Jana Pawła II 27, 00-867 Warszawa",
  nip: "5272788016",
  krs: "0000649014",
  sad: "Sąd Rejonowy dla m.st. Warszawy w Warszawie",
  kapital: "6 500 zł",
  email: "kontakt@getwinover.com",
};
export const WERSJA_PRAWNA = "wersja robocza z 12.10.2026";

export type Sekcja = { tytul: string; akapity: string[] };
export type Dokument = { tytul: string; wstep: string; sekcje: Sekcja[] };

const u = USLUGODAWCA;

const REGULAMIN: Record<Jezyk, Dokument> = {
  pl: {
    tytul: "Regulamin WinOver",
    wstep: `Regulamin określa zasady korzystania z platformy WinOver. Usługodawca: ${u.nazwa}, ${u.adres}, wpisana do rejestru przedsiębiorców KRS pod numerem ${u.krs} przez ${u.sad}, NIP ${u.nip}, kapitał zakładowy ${u.kapital}, kontakt: ${u.email}.`,
    sekcje: [
      {
        tytul: "1. Czym jest WinOver",
        akapity: [
          "WinOver to narzędzie do prowadzenia kampanii kierowanych do decydentów (posłów, europosłów, urzędów, instytucji). Pomaga dobrać odbiorców, przygotować wiadomości, wysłać je z poczty klienta i zmierzyć efekt.",
          "WinOver jest platformą pośredniczącą. Nie jest stroną kampanii, nie prowadzi lobbingu i nie wypowiada się w imieniu klienta. Kampanię prowadzi i za nią odpowiada zleceniodawca.",
        ],
      },
      {
        tytul: "2. Konto i dostęp",
        akapity: [
          "Konto zakładamy na zaproszenie. Klient (organizacja) może zapraszać do swojego konta kolejne osoby i odpowiada za ich działania.",
          "Dane logowania są poufne. O nieuprawnionym dostępie klient informuje nas niezwłocznie.",
        ],
      },
      {
        tytul: "3. Oświadczenie zleceniodawcy",
        akapity: [
          "Przed pierwszą wysyłką klient składa oświadczenie: kto zleca kampanię, z czego jest finansowana i czy działa we własnym imieniu. Oświadczenie zapisujemy wraz z datą, adresem IP i przeglądarką.",
          "Część kampanii uruchamia się od razu. Kampanie prowadzone na zlecenie innego podmiotu, związane z wyborami albo wymagające opinii prawnika czekają na akceptację WinOver.",
          "W wiadomościach organizacji i na stronie akcji pokazujemy stopkę z nazwą zleceniodawcy, źródłem finansowania i kontaktem.",
        ],
      },
      {
        tytul: "4. Obowiązki klienta",
        akapity: [
          "Klient odpowiada za treść kampanii, jej zgodność z prawem i prawdziwość informacji, w tym za obowiązki wynikające z ustawy z 7 lipca 2005 r. o działalności lobbingowej w procesie stanowienia prawa, przepisów o ochronie danych osobowych i o komunikacji elektronicznej.",
          "Zakazane jest: podszywanie się pod inną osobę lub organizację, ukrywanie zleceniodawcy albo źródła finansowania, udawanie oddolnej inicjatywy, treści niezgodne z prawem, nękanie odbiorców.",
          "Każdą wiadomość przygotowaną z pomocą sztucznej inteligencji przed wysyłką czyta i zatwierdza człowiek po stronie klienta.",
        ],
      },
      {
        tytul: "5. Prawo odmowy i wstrzymania",
        akapity: [
          "WinOver może odmówić uruchomienia kampanii albo ją wstrzymać, gdy oświadczenie jest niewiarygodne, treść narusza prawo lub regulamin, albo wysyłka szkodzi odbiorcom lub platformie.",
        ],
      },
      {
        tytul: "6. Odpowiedzialność",
        akapity: [
          "WinOver dostarcza narzędzie i dokłada staranności, żeby działało. Nie gwarantuje, że decydent odpowie ani że kampania zmieni decyzję.",
          "WinOver nie odpowiada za treść kampanii ani za skutki jej wysłania, o ile nie wynikają z naszej winy.",
        ],
      },
      {
        tytul: "7. Dane osobowe",
        akapity: [
          "Zasady przetwarzania danych opisuje Polityka prywatności. Wobec danych odbiorców i sympatyków kampanii administratorem jest klient, a WinOver przetwarza je w jego imieniu.",
        ],
      },
      {
        tytul: "8. Zmiany i kontakt",
        akapity: [
          `Regulamin może się zmienić; o istotnych zmianach informujemy z wyprzedzeniem. Pytania i reklamacje: ${u.email}.`,
        ],
      },
    ],
  },
  en: {
    tytul: "WinOver terms of service",
    wstep: `These terms govern the use of the WinOver platform. Provider: ${u.nazwa}, ${u.adres}, entered in the Polish National Court Register (KRS) under no. ${u.krs}, tax ID ${u.nip}, share capital PLN 6,500, contact: ${u.email}.`,
    sekcje: [
      {
        tytul: "1. What WinOver is",
        akapity: [
          "WinOver is a tool for running campaigns aimed at decision-makers (MPs, MEPs, public offices, institutions). It helps choose recipients, prepare messages, send them from the client's mailbox and measure the effect.",
          "WinOver is an intermediary platform. It is not a party to any campaign, does not lobby and does not speak on the client's behalf. The client who commissions a campaign runs it and is responsible for it.",
        ],
      },
      {
        tytul: "2. Account and access",
        akapity: [
          "Accounts are created by invitation. A client (organisation) may invite further people to its account and is responsible for their actions.",
          "Login details are confidential. The client informs us without delay of any unauthorised access.",
        ],
      },
      {
        tytul: "3. Client declaration",
        akapity: [
          "Before the first send, the client declares who commissions the campaign, how it is funded and whether it acts on its own behalf. We store the declaration with its date, IP address and browser.",
          "Some campaigns start immediately. Campaigns run on behalf of another entity, linked to an election or needing a lawyer's opinion wait for WinOver's approval.",
          "Messages sent by the organisation and the action page carry a footer with the client's name, source of funding and contact.",
        ],
      },
      {
        tytul: "4. Client obligations",
        akapity: [
          "The client is responsible for the campaign's content, its lawfulness and the truth of its information, including obligations under lobbying, data protection and electronic communications law.",
          "Prohibited: impersonating another person or organisation, hiding the client or the source of funding, faking a grassroots initiative, unlawful content, harassing recipients.",
          "A person on the client's side reads and approves every message prepared with the help of artificial intelligence before it is sent.",
        ],
      },
      {
        tytul: "5. Right to refuse and pause",
        akapity: [
          "WinOver may refuse to launch a campaign or pause it when the declaration is not credible, the content breaks the law or these terms, or sending harms recipients or the platform.",
        ],
      },
      {
        tytul: "6. Liability",
        akapity: [
          "WinOver provides the tool and takes care that it works. It does not guarantee that a decision-maker will reply or that a campaign will change a decision.",
          "WinOver is not liable for campaign content or the consequences of sending it, unless caused by our fault.",
        ],
      },
      {
        tytul: "7. Personal data",
        akapity: [
          "The Privacy policy describes how we process data. For data of campaign recipients and supporters the client is the controller and WinOver processes it on the client's behalf.",
        ],
      },
      {
        tytul: "8. Changes and contact",
        akapity: [`These terms may change; we announce material changes in advance. Questions and complaints: ${u.email}.`],
      },
    ],
  },
};

const PRYWATNOSC: Record<Jezyk, Dokument> = {
  pl: {
    tytul: "Polityka prywatności WinOver",
    wstep: `Opisujemy, jakie dane przetwarzamy, po co i jakie masz prawa. Kontakt w sprawie danych: ${u.email}.`,
    sekcje: [
      {
        tytul: "1. Kto jest administratorem",
        akapity: [
          `Dane użytkowników kont WinOver (klientów i ich zespołów) przetwarza ${u.nazwa}, ${u.adres}, KRS ${u.krs}, NIP ${u.nip}.`,
          "Dane odbiorców kampanii i sympatyków, którzy podpisują się na stronie akcji, przetwarza organizator danej kampanii jako administrator. Jego nazwa i kontakt są na stronie akcji i w stopce wiadomości. WinOver przetwarza te dane w jego imieniu, na podstawie umowy powierzenia.",
        ],
      },
      {
        tytul: "2. Jakie dane i po co",
        akapity: [
          "Użytkownicy kont: e-mail, hasło (zaszyfrowane), dane oświadczenia zleceniodawcy, adres IP i przeglądarka przy oświadczeniu. Cel: prowadzenie konta, bezpieczeństwo, dowód złożenia oświadczenia. Podstawa: umowa i prawnie uzasadniony interes.",
          "Odbiorcy kampanii: imię, nazwisko, stanowisko i służbowy adres e-mail z publicznych rejestrów (np. Sejm, Parlament Europejski, baza teleadresowa samorządów) albo z listy klienta; zdarzenia: kliknięcia w linki, odpowiedzi, wypisanie. Cel: wysyłka kampanii i raport. Podstawa: prawnie uzasadniony interes organizatora.",
          "Sympatycy na stronie akcji: imię, nazwisko, gmina, e-mail, źródło wejścia, skrót adresu IP (ochrona przed botami). Cel: przygotowanie wiadomości i, na wyraźne polecenie sympatyka potwierdzone linkiem z maila, wysłanie jej w jego imieniu do wybranego decydenta, z jego imieniem i nazwiskiem jako nadawcą i jego adresem do odpowiedzi. E-mail przekazujemy organizatorowi tylko przy osobnej zgodzie na kontakt. Sympatyk może też wysłać wiadomość sam ze swojej poczty.",
        ],
      },
      {
        tytul: "3. Komu przekazujemy dane",
        akapity: [
          "Dostawcom, bez których usługa nie działa: hosting bazy danych (Supabase, serwery w Unii Europejskiej, Frankfurt), hosting aplikacji (Vercel), model językowy do przygotowania wiadomości (Anthropic; przekazujemy opis kampanii i materiały, nie listy odbiorców), wysyłka wiadomości sympatyków i maili potwierdzających (Resend). Poczta organizacji wychodzi ze skrzynki klienta przez jego dostawcę.",
        ],
      },
      {
        tytul: "4. Jak długo",
        akapity: [
          "Dane konta: przez czas korzystania z usługi. Oświadczenia zleceniodawców: do 7 lat, jako dowód na wypadek pytań organów. Dane kampanii i sympatyków: przez czas kampanii i do usunięcia przez organizatora.",
        ],
      },
      {
        tytul: "5. Twoje prawa",
        akapity: [
          "Masz prawo do dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia i sprzeciwu, a także do skargi do Prezesa Urzędu Ochrony Danych Osobowych. Z wiadomości kampanii możesz się wypisać jednym kliknięciem.",
        ],
      },
      {
        tytul: "6. Pliki cookie",
        akapity: [
          "Używamy wyłącznie niezbędnych plików cookie: sesji logowania i wybranego języka. Nie używamy cookie reklamowych.",
        ],
      },
    ],
  },
  en: {
    tytul: "WinOver privacy policy",
    wstep: `What data we process, why, and what your rights are. Data contact: ${u.email}.`,
    sekcje: [
      {
        tytul: "1. Who the controller is",
        akapity: [
          `Data of WinOver account users (clients and their teams) is processed by ${u.nazwa}, ${u.adres}, KRS ${u.krs}, tax ID ${u.nip}.`,
          "Data of campaign recipients and of supporters who sign on an action page is processed by the organiser of that campaign as controller. Their name and contact are on the action page and in the message footer. WinOver processes this data on their behalf under a data processing agreement.",
        ],
      },
      {
        tytul: "2. What data and why",
        akapity: [
          "Account users: e-mail, password (encrypted), client declaration details, IP address and browser at the time of the declaration. Purpose: running the account, security, proof of the declaration. Basis: contract and legitimate interest.",
          "Campaign recipients: name, position and work e-mail from public registers (e.g. the Sejm, the European Parliament, local government directories) or from the client's list; events: link clicks, replies, unsubscribes. Purpose: sending the campaign and the report. Basis: the organiser's legitimate interest.",
          "Supporters on an action page: name, municipality, e-mail, entry source, a hash of the IP address (bot protection). Purpose: preparing the message and, on the supporter's explicit instruction confirmed by an e-mail link, sending it on their behalf to the chosen decision-maker, with their name as the sender and their address for replies. We share the e-mail with the organiser only with separate consent to contact. Supporters may also send the message themselves from their own mailbox.",
        ],
      },
      {
        tytul: "3. Who receives data",
        akapity: [
          "Providers without whom the service does not work: database hosting (Supabase, servers in the European Union, Frankfurt), application hosting (Vercel), a language model for drafting messages (Anthropic; we send the campaign description and materials, not recipient lists), sending of supporters' messages and confirmation e-mails (Resend). The organisation's e-mail leaves from the client's mailbox through its provider.",
        ],
      },
      {
        tytul: "4. How long",
        akapity: [
          "Account data: while you use the service. Client declarations: up to 7 years, as evidence in case authorities ask. Campaign and supporter data: for the duration of the campaign and until the organiser deletes it.",
        ],
      },
      {
        tytul: "5. Your rights",
        akapity: [
          "You may access, correct, delete, restrict, port and object to the processing of your data, and complain to the data protection authority. You can unsubscribe from campaign messages with one click.",
        ],
      },
      {
        tytul: "6. Cookies",
        akapity: ["We use only necessary cookies: the login session and the chosen language. We use no advertising cookies."],
      },
    ],
  },
};


/**
 * Strona dla biur poselskich i urzędów (14.10, wzorzec WriteToThem "for MPs"): jakie zasady gwarantuje WinOver
 * po stronie odbiorcy. Link w stopce wiadomości mieszkańców i zestawień.
 */
const DLA_BIUR: Record<Jezyk, Dokument> = {
  pl: {
    tytul: "WinOver dla biur poselskich i urzędów",
    wstep: `Dostali Państwo wiadomość wysłaną przez WinOver. Oto zasady, które obowiązują każdego nadawcę. Zgłoszenia i pytania: ${u.email}.`,
    sekcje: [
      {
        tytul: "1. Piszą prawdziwi ludzie",
        akapity: [
          "Wiadomość mieszkańca wychodzi dopiero wtedy, gdy potwierdzi ją kliknięciem w link wysłany na jego skrzynkę. Nie da się wysłać wiadomości w czyimś imieniu bez dostępu do jego poczty.",
          "Nadawca podaje imię, nazwisko i gminę. Odpowiedź na wiadomość trafia bezpośrednio do niego.",
          "Gdy kilka osób próbuje wysłać do tego samego adresata identyczną treść, prosimy je o dopisanie własnego zdania.",
        ],
      },
      {
        tytul: "2. Organizacja jest jawna",
        akapity: [
          "Każda kampania ma złożone oświadczenie zleceniodawcy: kto ją prowadzi, z czego jest finansowana i czy działa na czyjeś zlecenie. Wiadomości organizacji mają stopkę z tymi danymi.",
          "Treść przygotowaną z pomocą sztucznej inteligencji przed wysyłką czyta i zatwierdza człowiek po stronie organizacji.",
        ],
      },
      {
        tytul: "3. Nie zasypujemy skrzynek",
        akapity: [
          "Jeden adresat dostaje najwyżej 40 wiadomości mieszkańców na dobę; nadmiar czeka do następnego dnia.",
          "Organizacja może wybrać jedno dzienne zestawienie zamiast pojedynczych maili: wtedy biuro dostaje jedną wiadomość ze wszystkimi opiniami mieszkańców.",
          "Adresy, z których wiadomości wracają albo które zgłoszono jako spam, trafiają na listę blokad.",
        ],
      },
      {
        tytul: "4. Jak zgłosić problem",
        akapity: [
          `Jeśli wiadomość wygląda na nadużycie (fałszywy nadawca, nękanie, treść niezgodna z prawem), prosimy o mail na ${u.email} z przekazaną wiadomością. Możemy wstrzymać kampanię.`,
          "Z wiadomości organizacji można się wypisać jednym kliknięciem (link w stopce i nagłówek wypisania).",
        ],
      },
    ],
  },
  en: {
    tytul: "WinOver for parliamentary and public offices",
    wstep: `You received a message sent through WinOver. These are the rules every sender follows. Reports and questions: ${u.email}.`,
    sekcje: [
      {
        tytul: "1. Real people write",
        akapity: [
          "A resident's message goes out only after they confirm it by clicking a link sent to their own mailbox. Nobody can send a message in someone else's name without access to their email.",
          "The sender gives their name and municipality. Replies go straight to them.",
          "When several people try to send identical text to the same recipient, we ask them to add a sentence of their own.",
        ],
      },
      {
        tytul: "2. The organisation is disclosed",
        akapity: [
          "Every campaign has a client declaration: who runs it, how it is funded and whether it acts on someone's behalf. Organisation emails carry a footer with these details.",
          "A person on the organisation's side reads and approves any text prepared with the help of artificial intelligence before it is sent.",
        ],
      },
      {
        tytul: "3. We do not flood inboxes",
        akapity: [
          "One recipient gets at most 40 residents' messages a day; the rest waits until the next day.",
          "An organisation can choose one daily digest instead of single emails: the office then gets one message with all residents' views.",
          "Addresses that bounce or report spam are added to a block list.",
        ],
      },
      {
        tytul: "4. How to report a problem",
        akapity: [
          `If a message looks like abuse (fake sender, harassment, unlawful content), please forward it to ${u.email}. We can pause the campaign.`,
          "Organisation emails have one-click unsubscribe (footer link and unsubscribe header).",
        ],
      },
    ],
  },
};

export const dokumentPrawny = (rodzaj: "regulamin" | "prywatnosc" | "dla-biur", jezyk: Jezyk): Dokument =>
  (rodzaj === "regulamin" ? REGULAMIN : rodzaj === "dla-biur" ? DLA_BIUR : PRYWATNOSC)[jezyk];
