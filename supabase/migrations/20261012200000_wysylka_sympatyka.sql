-- Wysylka w imieniu mieszkanca (wariant B, decyzja Jana 12.10): mieszkaniec podaje imie, nazwisko, e-mail,
-- klika "Wyslij", potwierdza mailem, WinOver wysyla jako "Imie Nazwisko" z naszej domeny, odpowiedz do niego.
-- Twórca akcji widzi status i czas; e-mail tylko przy zgodzie na kontakt (podpisy.email). Adres do wysylki
-- i token potwierdzenia leza w osobnej tabeli bez polityk RLS (czyta tylko serwer).

alter table public.podpisy
  add column status_wysylki text not null default ''
    check (status_wysylki in ('', 'czeka_na_potwierdzenie', 'w_kolejce', 'wyslany', 'blad')),
  add column potwierdzono timestamptz,
  add column wyslano timestamptz,
  add column zglosil_odpowiedz timestamptz;
comment on column public.podpisy.status_wysylki is '"" = mieszkaniec nie wybral wysylki przez WinOver (np. wyslal ze swojej poczty).';

create table public.podpisy_wysylka (
  podpis_id uuid primary key references public.podpisy(id) on delete cascade,
  email text not null,
  token text not null unique,
  utworzony timestamptz not null default now(),
  potwierdzenie_wyslane timestamptz,
  message_id text,
  proba boolean not null default false,
  blad text
);
create index podpisy_wysylka_email_idx on public.podpisy_wysylka (email, potwierdzenie_wyslane);
alter table public.podpisy_wysylka enable row level security;
-- Brak polityk: tylko klient serwisowy.

-- E-mail w tabeli widocznej dla tworcy akcji zostaje tylko przy zgodzie na kontakt (decyzja 12.10, RODO).
update public.podpisy set email = null where not zgoda_informacje and email is not null;

create index podpisy_kontakt_wyslano_idx on public.podpisy (kontakt_id, wyslano);
