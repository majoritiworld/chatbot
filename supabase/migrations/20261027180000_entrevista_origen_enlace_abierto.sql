-- Interviews started from a phase's open link. Someone already invited to the
-- phase can still answer through the link: it gives them a new interview and
-- never opens their personal one. One interview per person and template still
-- holds for every other interview.
alter table public.entrevista
  add column if not exists origen text;

alter table public.entrevista
  drop constraint if exists entrevista_origen_check;
alter table public.entrevista
  add constraint entrevista_origen_check
  check (origen is null or origen = 'enlace_abierto');

update public.entrevista e
set origen = 'enlace_abierto'
from public.tarea t
where t.entrevista_id = e.id
  and t.stakeholder_id is null
  and t.created_at >= '2026-10-26 14:00:00+00'
  and t.fase_id in (
    select id from public.fase where enlace_abierto_hash is not null
  );

create unique index if not exists entrevista_stakeholder_plantilla_invitada_uidx
  on public.entrevista (stakeholder_id, plantilla_id)
  where plantilla_id is not null and origen is null;

drop index if exists public.entrevista_stakeholder_plantilla_uidx;
