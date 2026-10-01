# Notion del piloto ETM

Preparado el 1 de octubre de 2026. No publica las conversaciones ficticias de la demo local.

## Proyecto verificado

Hay una sola página de proyecto con el nombre «Consultoria ETM» en Projects (`collection://4e10d8e1-eda6-49c0-b200-41cec303207d`).

- Página: `3e531b45-3629-8009-9e8b-f7eaa307501d`
- URL: https://app.notion.com/p/3e531b45362980099e8bf7eaa307501d

La relación de cada transcripción del piloto usa ese ID. No se crea otro proyecto.

El proyecto de ComplianceLatam es otro: «Consultoria ComplianceLatam», `3d631b45-3629-8087-a003-c4f9482d47ee`. Las entrevistas ETM no se escriben en su base Interviews (`e043fecb-df40-4496-baae-8a46daedc03f`) ni se relacionan con esa página.

## Destino

La base que ya está dentro de la página del proyecto se llama «ETM Interviews» (`3e531b45-3629-80bb-a84b-000b4f1d5381`). Ahí quedan, cuando la integración esté habilitada:

- «ID entrevista»: el ID de la entrevista. Reintentar la misma entrevista no abre otra página. Un título igual no reutiliza una página distinta.
- «Participante»: relación con People, solo si ya existe una persona única con ese correo o ese nombre. No se crean personas.
- «Segmento»: Mentor, Mentoreado o Sponsor, según la fase.
- «Proyecto»: relación con `3e531b45-3629-8009-9e8b-f7eaa307501d`.

La base sigue vacía. No se cargaron las seis conversaciones ficticias.

## Qué falta para habilitarla

- El piloto tiene que correr con este publicador y con `NOTION_API_KEY` en ese servidor. La demo local debe seguir con esas variables vacías, como en `docs/demo-etm-tuesday.md`.
- No sincronizar Marina Lagos, Tomás Rivas, Sofía Paredes, Diego Muñoz, Camila Soto ni Andrés Vidal. El código omite correos `@example.test` y el proyecto «ETM Tuesday (demo local)».
- Cargar en People a los participantes reales si la relación «Participante» debe quedar llena. Sin una coincidencia única, la página se crea igual y el nombre queda en el título.
- No volcar después las transcripciones ficticias ya guardadas en la base local.
