-- Replace the previous Majoriti promotion only in phases that already show it.
-- Label, link and phases without a promotion stay as they are.
UPDATE public.fase
SET bloque_comercial = 'Majoriti te ayuda a escuchar a tus clientes, equipos y socios a escala, para tomar decisiones mejor informadas.'
WHERE trim(bloque_comercial) IN (
  E'Esta entrevista fue diseñada junto a Majoriti.\n\n¿Te imaginas escuchar así a tus clientes, equipos o socios? Prueba una demo y descubre cómo convertir sus experiencias en información para tomar mejores decisiones.',
  E'Esta entrevista fue diseñada junto a Majoriti.\n\n¿Se imagina escuchar así a sus clientes, equipos o socios? Conozca cómo convertir sus experiencias en información para decidir mejor.',
  'Majoriti te permite escuchar a tus stakeholders a escala para tomar mejores decisiones.'
);
