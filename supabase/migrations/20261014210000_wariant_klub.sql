-- Wersja wiadomości dla klubu (14.10, wzorzec Engaging Networks): wariant z dla_klubu trafia tylko do posłów
-- tego klubu (kontakty.organizacja); warianty bez klubu idą do pozostałych. null = dla wszystkich.
alter table public.warianty add column if not exists dla_klubu text;
