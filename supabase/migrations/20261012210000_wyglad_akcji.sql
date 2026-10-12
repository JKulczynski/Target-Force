-- Kreator strony akcji (12.10): wyglad strony per kampania + magazyn zdjec i logo.
-- akcja_wyglad: {obraz, logo, kolor, cel, przycisk, dziekujemy, uklad}; walidacja w lib/wyglad.ts.
alter table public.kampanie add column akcja_wyglad jsonb not null default '{}'::jsonb;

-- Publiczny odczyt (strona akcji jest publiczna), zapis tylko do folderu kampanii, do ktorej ma sie dostep.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('akcja', 'akcja', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

create policy "akcja: wgrywanie do swojej kampanii" on storage.objects for insert to authenticated
  with check (bucket_id = 'akcja' and public.czy_dostep_kampania(((storage.foldername(name))[1])::uuid));
create policy "akcja: podmiana w swojej kampanii" on storage.objects for update to authenticated
  using (bucket_id = 'akcja' and public.czy_dostep_kampania(((storage.foldername(name))[1])::uuid));
create policy "akcja: usuwanie w swojej kampanii" on storage.objects for delete to authenticated
  using (bucket_id = 'akcja' and public.czy_dostep_kampania(((storage.foldername(name))[1])::uuid));
