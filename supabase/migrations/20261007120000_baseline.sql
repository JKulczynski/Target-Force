-- Baseline schematu Target Force, zrzut z produkcji 07.10.2026 (projekt vvlonnvqbzhdqedhvnoq).
-- Do tej pory schemat zyl tylko w Supabase (zmiany przez panel i MCP). Od teraz kazda zmiana = nowy plik tutaj.
-- Odtworzenie pustego srodowiska: supabase db reset (lokalnie) albo apply_migration po kolei.

-- Funkcja dostepu: czy zalogowany jest w zespole. Wszystkie polityki RLS na niej stoja.
create table public.zespol (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  dodany timestamptz not null default now()
);

create or replace function public.czy_w_zespole() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.zespol where user_id = (select auth.uid()));
$$;
revoke execute on function public.czy_w_zespole() from anon;

create table public.skrzynki (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null,
  email_nadawcy text not null,
  smtp_host text not null,
  smtp_port integer not null default 587,
  smtp_uzytkownik text not null,
  dzienny_limit integer not null default 50 check (dzienny_limit >= 1 and dzienny_limit <= 2000),
  spf text not null default 'nieznany' check (spf in ('ok','brak','blad','nieznany')),
  dkim text not null default 'nieznany' check (dkim in ('ok','brak','blad','nieznany')),
  dmarc text not null default 'nieznany' check (dmarc in ('ok','brak','blad','nieznany')),
  sprawdzona timestamptz,
  utworzona timestamptz not null default now()
);

-- Hasla SMTP (zaszyfrowane kluczem TF_KLUCZ_SZYFROWANIA) tylko przez funkcje, tabela bez polityk.
create table public.skrzynki_sekrety (
  skrzynka_id uuid primary key references public.skrzynki(id) on delete cascade,
  haslo_zaszyfrowane text not null,
  zmienione timestamptz not null default now()
);
create unique index skrzynki_sekrety_skrzynka_uq on public.skrzynki_sekrety (skrzynka_id);

create table public.kampanie (
  id uuid primary key default gen_random_uuid(),
  nazwa text not null,
  status text not null default 'szkic' check (status in ('szkic','gotowa','uruchomiona','zakonczona')),
  zrodla text[] not null default '{}',
  kogo_szukamy text not null default '',
  cel text not null default '',
  nadawca text not null default '',
  psychografia boolean not null default true,
  liczba_wariantow integer not null default 7 check (liczba_wariantow >= 1 and liczba_wariantow <= 20),
  skrzynka_id uuid references public.skrzynki(id) on delete set null,
  utworzyl uuid default auth.uid() references auth.users(id) on delete set null,
  utworzona timestamptz not null default now(),
  link_film text not null default '',
  materialy text not null default '',
  liczba_followupow integer not null default 2 check (liczba_followupow >= 0 and liczba_followupow <= 5),
  odstep_dni integer not null default 4 check (odstep_dni >= 1 and odstep_dni <= 30),
  start date,
  psychografia_opis text,
  jezyk text,
  filtr_odbiorcow jsonb not null default '{}',
  auto_wysylka boolean not null default false,
  akcja_wlaczona boolean not null default false,
  akcja_slug text,
  akcja_tytul text not null default '',
  akcja_opis text not null default '',
  akcja_administrator text not null default ''
);
create index kampanie_skrzynka_id_idx on public.kampanie (skrzynka_id);
create unique index kampanie_akcja_slug_idx on public.kampanie (akcja_slug) where akcja_slug is not null;
comment on column public.kampanie.auto_wysylka is 'Codzienna automatyczna wysylka (cron w dni robocze rano): kolejna partia w limicie skrzynki + przypomnienia, od dnia start.';
comment on column public.kampanie.akcja_slug is 'Adres publicznej strony akcji: /a/{slug}. Null = strona nie istnieje.';
comment on column public.kampanie.akcja_administrator is 'Administrator danych sympatykow (nazwa i kontakt) do informacji RODO na stronie akcji.';

create table public.kontakty (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  zrodlo text not null,
  zewnetrzne_id text,
  imie text,
  nazwisko text,
  email text,
  organizacja text,
  stanowisko text,
  dane jsonb not null default '{}',
  psychografia text,
  wypisany boolean not null default false,
  utworzony timestamptz not null default now(),
  odpowiedzial timestamptz,
  unique (kampania_id, email)
);
create index kontakty_kampania_id_idx on public.kontakty (kampania_id);

create table public.warianty (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  krok integer not null default 0,
  numer integer not null default 1,
  temat text not null default '',
  tresc text not null default '',
  status text not null default 'szkic' check (status in ('szkic','zatwierdzony','odrzucony')),
  utworzony timestamptz not null default now(),
  zmieniony timestamptz not null default now(),
  rola text not null default 'nadawca' check (rola in ('nadawca','sympatyk'))
);
create index warianty_kampania_idx on public.warianty (kampania_id, krok, numer);

create table public.wiadomosci (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  kontakt_id uuid not null references public.kontakty(id) on delete cascade,
  krok integer not null default 0,
  wariant integer,
  temat text not null default '',
  tresc text not null default '',
  status text not null default 'szkic' check (status in ('szkic','zaplanowana','wyslana','blad','odpowiedz','wstrzymana')),
  zaplanowana_na timestamptz,
  wyslana timestamptz,
  message_id text,
  blad text,
  utworzona timestamptz not null default now(),
  kod text default substring(md5(gen_random_uuid()::text), 1, 8),
  unique (kampania_id, kontakt_id, krok)
);
create index wiadomosci_kampania_id_idx on public.wiadomosci (kampania_id);
create index wiadomosci_kontakt_id_idx on public.wiadomosci (kontakt_id);
create index wiadomosci_status_zaplanowana_na_idx on public.wiadomosci (status, zaplanowana_na);
create unique index wiadomosci_kod_uniq on public.wiadomosci (kod);
create index wiadomosci_wyslana_idx on public.wiadomosci (wyslana) where wyslana is not null;

create table public.zdarzenia (
  id bigint generated always as identity primary key,
  wiadomosc_id uuid not null references public.wiadomosci(id) on delete cascade,
  typ text not null check (typ in ('otwarcie','klikniecie','odpowiedz','odbicie','wypisanie')),
  url text,
  meta jsonb not null default '{}',
  utworzone timestamptz not null default now()
);
create index zdarzenia_wiadomosc_id_idx on public.zdarzenia (wiadomosc_id);

create table public.pe_emaile (
  identifier text primary key,
  email text,
  pobrano timestamptz not null default now()
);

create table public.podpisy (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  imie text not null,
  nazwisko text not null default '',
  email text,
  zgoda_informacje boolean not null default false,
  gmina_teryt text,
  gmina_nazwa text,
  okreg_nr integer,
  kontakt_id uuid references public.kontakty(id) on delete set null,
  odbiorca_email text,
  odbiorca_nazwa text,
  wariant_id uuid references public.warianty(id) on delete set null,
  temat text not null default '',
  tresc text not null default '',
  otworzyl_poczte timestamptz,
  udostepnil timestamptz,
  ip_hash text,
  utworzony timestamptz not null default now()
);
create index podpisy_kampania_idx on public.podpisy (kampania_id, utworzony desc);

create table public.wydarzenia_wplywu (
  id uuid primary key default gen_random_uuid(),
  kampania_id uuid not null references public.kampanie(id) on delete cascade,
  data date not null default current_date,
  typ text not null default 'inne' check (typ in ('odpowiedz','spotkanie','interpelacja','zmiana_decyzji','media','inne')),
  opis text not null,
  kontakt_id uuid references public.kontakty(id) on delete set null,
  utworzone timestamptz not null default now()
);
create index wydarzenia_wplywu_kampania_idx on public.wydarzenia_wplywu (kampania_id, data desc);

-- RLS: dane widzi i zmienia tylko zespol. Strona akcji i cron pisza klientem serwisowym (omija RLS).
alter table public.zespol enable row level security;
alter table public.skrzynki enable row level security;
alter table public.skrzynki_sekrety enable row level security;
alter table public.kampanie enable row level security;
alter table public.kontakty enable row level security;
alter table public.warianty enable row level security;
alter table public.wiadomosci enable row level security;
alter table public.zdarzenia enable row level security;
alter table public.pe_emaile enable row level security;
alter table public.podpisy enable row level security;
alter table public.wydarzenia_wplywu enable row level security;

create policy "zespol widzi zespol" on public.zespol for select to authenticated using ((select public.czy_w_zespole()));
create policy "zespol: skrzynki" on public.skrzynki for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
create policy "zespol: kampanie" on public.kampanie for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
create policy "zespol: kontakty" on public.kontakty for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
create policy "zespol: warianty" on public.warianty for all to public using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
create policy "zespol: wiadomosci" on public.wiadomosci for all to authenticated using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));
create policy "zespol: zdarzenia odczyt" on public.zdarzenia for select to authenticated using ((select public.czy_w_zespole()));
create policy "zespol: pe_emaile odczyt" on public.pe_emaile for select to public using ((select public.czy_w_zespole()));
create policy "zespol: podpisy odczyt" on public.podpisy for select to public using ((select public.czy_w_zespole()));
create policy "zespol: wydarzenia_wplywu" on public.wydarzenia_wplywu for all to public using ((select public.czy_w_zespole())) with check ((select public.czy_w_zespole()));

-- Hasla skrzynek: zapis i odczyt tylko przez funkcje, po sprawdzeniu zespolu.
create or replace function public.zapisz_sekret_skrzynki(p_skrzynka uuid, p_haslo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.czy_w_zespole() then
    raise exception 'brak dostepu';
  end if;
  insert into public.skrzynki_sekrety (skrzynka_id, haslo_zaszyfrowane, zmienione)
  values (p_skrzynka, p_haslo, now())
  on conflict (skrzynka_id) do update set haslo_zaszyfrowane = excluded.haslo_zaszyfrowane, zmienione = now();
end;
$$;
revoke execute on function public.zapisz_sekret_skrzynki(uuid, text) from anon;

create or replace function public.pobierz_sekret_skrzynki(p_skrzynka uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare wynik text;
begin
  if not public.czy_w_zespole() then
    raise exception 'brak dostepu';
  end if;
  select haslo_zaszyfrowane into wynik from public.skrzynki_sekrety where skrzynka_id = p_skrzynka;
  return wynik;
end;
$$;
revoke execute on function public.pobierz_sekret_skrzynki(uuid) from anon;

-- Linki sledzace: publiczne (klika odbiorca bez konta). Baza przepuszcza tylko adres z tresci tej wiadomosci.
create or replace function public.zapisz_klikniecie(p_wiadomosc uuid, p_url text) returns text
language plpgsql security definer set search_path = 'public' as $$
declare
  v_tresc text;
begin
  select tresc into v_tresc from wiadomosci where id = p_wiadomosc;
  if v_tresc is null or p_url is null or length(p_url) > 2000 or position(p_url in v_tresc) = 0 then
    return null;
  end if;
  insert into zdarzenia (wiadomosc_id, typ, url) values (p_wiadomosc, 'klikniecie', p_url);
  return p_url;
end;
$$;

create or replace function public.zapisz_klikniecie_kod(p_kod text, p_nr integer) returns text
language plpgsql security definer set search_path = 'public' as $$
declare v_id uuid; v_tresc text; v_url text;
begin
  if p_kod !~ '^[0-9a-f]{8}$' or p_nr < 1 or p_nr > 50 then return null; end if;
  select id, tresc into v_id, v_tresc from wiadomosci where kod = p_kod;
  if v_tresc is null then return null; end if;
  select m[1] into v_url from (
    select m, row_number() over () as nr
    from regexp_matches(v_tresc, '(https?://[^[:space:]<>()"'']+[^[:space:]<>()"''.,;:!?])', 'g') as m
  ) t where nr = p_nr;
  if v_url is null then return null; end if;
  insert into zdarzenia (wiadomosc_id, typ, url) values (v_id, 'klikniecie', v_url);
  return v_url;
end; $$;
