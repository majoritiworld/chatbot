-- Open link for a phase: anyone with it fills in name, email and company and
-- gets a new interview from the phase template. Only the SHA-256 of the token
-- is stored; null turns the link off.
alter table public.fase
  add column if not exists enlace_abierto_hash text;

create unique index if not exists fase_enlace_abierto_hash_key
  on public.fase (enlace_abierto_hash)
  where enlace_abierto_hash is not null;
