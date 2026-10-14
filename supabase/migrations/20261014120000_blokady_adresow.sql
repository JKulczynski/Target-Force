-- Odbicia i zgłoszenia spamu z Resend (14.10). Adres na liście = WinOver już do niego nie pisze
-- (potwierdzenia, wiadomości mieszkańców, maile do sympatyków). Tylko serwer: RLS bez polityk.
create table if not exists public.blokady_adresow (
  email text primary key,
  powod text not null check (powod in ('odbicie', 'skarga')),
  message_id text,
  kiedy timestamptz not null default now()
);
alter table public.blokady_adresow enable row level security;
