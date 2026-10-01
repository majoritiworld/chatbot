-- Show the Majoriti footer in the ComplianceLatam collaborator thank-you,
-- with the same button and link as the partner-firm phase.
-- Only that phase changes; running it again leaves the same values.
UPDATE public.fase AS colaboradores
SET
  bloque_comercial = 'Majoriti te ayuda a escuchar a tus clientes, equipos y socios a escala, para tomar decisiones mejor informadas.',
  bloque_comercial_etiqueta = socias.bloque_comercial_etiqueta,
  bloque_comercial_url = socias.bloque_comercial_url
FROM public.fase AS socias
JOIN public.proyecto AS proyecto ON proyecto.id = socias.proyecto_id
WHERE colaboradores.id = 'e332c5bb-d1b7-459d-9261-4906646bb9f7'
  AND colaboradores.nombre = 'Entrevistas a colaboradores'
  AND colaboradores.proyecto_id = socias.proyecto_id
  AND socias.id = 'c0000000-0000-4000-a000-000000000102'
  AND proyecto.slug = 'compliance-latam'
  AND socias.bloque_comercial_etiqueta IS NOT NULL
  AND socias.bloque_comercial_url IS NOT NULL;
