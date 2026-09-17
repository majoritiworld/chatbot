-- Meeting notes the client can open from past calendar dates.

ALTER TABLE public.evento
  ADD COLUMN IF NOT EXISTS minuta text;
