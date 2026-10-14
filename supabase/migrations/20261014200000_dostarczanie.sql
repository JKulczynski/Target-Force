-- Dostarczanie wiadomości mieszkańców (14.10): od razu (każda osobno) albo jedno zestawienie dziennie
-- dla każdego adresata (lib/zestawienie.ts). Potwierdzone wiadomości w trybie zestawienia czekają jako w_kolejce.
alter table public.kampanie add column if not exists akcja_dostarczanie text not null default 'od_razu'
  check (akcja_dostarczanie in ('od_razu', 'zestawienie'));
