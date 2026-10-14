-- Głosowanie jako argument (14.10): wybrane głosowanie Sejmu przy kampanii. Pole {glosowanie} w treści
-- dostaje dla każdego posła jego głos ("za nowelizacją ..." / "przeciw nowelizacji ...").
alter table public.kampanie add column if not exists glosowanie jsonb;
