-- Zmiany w drodze (14.10): ustawa, której dotyczy kampania (ELI z Dziennika Ustaw). Projekty jej zmian
-- w Sejmie pokazujemy na żywo (sejmdiff.pl + API Sejmu), nie trzymamy ich w bazie.
alter table public.kampanie add column if not exists ustawa jsonb;
