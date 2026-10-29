-- Analityka strony akcji (29.10, notatka ze spotkania z Piotrem, pkt 7): wejścia na /a/{slug}.
-- Góra lejka do raportu: wejścia -> podpisy -> wysłane -> udostępnienia.
-- Bez ciasteczek i bez danych osobowych: tylko czas, źródło (utm / domena odsyłacza), typ urządzenia,
-- czy strona była osadzona w widżecie. Brak IP i identyfikatora osoby, więc liczymy wejścia, nie unikalnych ludzi.
create table if not exists public.akcja_wejscia (
  id bigint generated always as identity primary key,
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  utworzone timestamptz not null default now(),
  zrodlo jsonb not null default '{}'::jsonb,
  urzadzenie text not null default 'komputer' check (urzadzenie in ('telefon', 'komputer')),
  osadzona boolean not null default false
);
create index if not exists akcja_wejscia_kampania_idx on public.akcja_wejscia (kampania_id, utworzone desc);

alter table public.akcja_wejscia enable row level security;
-- Zapis tylko klient serwisowy (endpoint /api/akcja/{slug}/wejscie). Odczyt: kto ma dostęp do kampanii.
create policy "org: akcja_wejscia odczyt" on public.akcja_wejscia for select to authenticated
  using (public.czy_dostep_kampania(kampania_id));
