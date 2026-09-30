DO $profundidad$
DECLARE
  nuevas jsonb := $json$[{"descripcion":"Sobre lo que ComplianceLatam aporta a su firma.","maxSeguimientos":3,"preguntas":["Si su firma dejara de pertenecer a ComplianceLatam mañana, ¿qué perdería en la práctica?"],"seguimientos":["Si no menciona resultados concretos: ¿Recuerda alguna situación del último año en la que estar en la red haya hecho una diferencia para la firma?","Si menciona un contacto o referido, pero no su resultado: ¿En qué terminó esa oportunidad? ¿Llegó a convertirse en trabajo para la firma?","Si no queda claro el aporte de la red: ¿Cree que eso habría ocurrido de todas maneras o fue posible gracias a ComplianceLatam?","Si no explica cómo se registra el valor: ¿Tienen alguna forma de registrar esos resultados o quedan en conocimiento de quienes participaron?"],"titulo":"Valor de la red"},{"descripcion":"Sobre qué tanto se conoce ComplianceLatam dentro de su firma.","instrucciones":"Conocimiento y participación son distintos: que nadie más participe no significa que nadie conozca la red. No presupongas que hay otros equipos participantes. Si la persona acaba de mencionar un asunto concreto, profundiza en ese antes de pasar a otro objetivo. Prioriza, si todavía no surgió, cómo circula la información y qué ayudaría a que más personas la conocieran y participaran. Si no quedó claro quién participa, explóralo sin dar por hecho que existen otros equipos.","maxSeguimientos":3,"preguntas":["Dentro de su firma, ¿quiénes conocen ComplianceLatam y qué saben de lo que ofrece?"],"seguimientos":["Si no explica cómo circula la información: ¿Cómo se comparte hoy dentro de la firma la información que reciben de ComplianceLatam?","Si no explica qué facilitaría que más personas la conocieran o participaran: ¿Qué cree que ayudaría a que más personas de la firma la conocieran y participaran?","Si no quedó claro quién participa: ¿Quiénes participan hoy en las actividades de ComplianceLatam?","Si no precisa qué saben quienes sí la conocen: ¿Qué saben de lo que ofrece la red y de cómo pueden usarla?"],"titulo":"Conocimiento y participación dentro de la firma"},{"descripcion":"Sobre cómo usan hoy la membresía.","instrucciones":"El uso de herramientas de la red es un objetivo por cubrir. No lo prioriza por encima de un asunto concreto que la persona acaba de mencionar. No saltes a una actividad que no nombró ni des por hecho que no participó.","maxSeguimientos":3,"preguntas":["En el último año, ¿cómo ha usado su firma la membresía de ComplianceLatam y qué le ha impedido aprovecharla más?"],"seguimientos":["Prioritario, si no describe el uso de herramientas: ¿Qué medios o herramientas de ComplianceLatam utilizan para coordinar su participación? Cuénteme cómo los usaron la última vez.","Si dice que no utilizan esas herramientas y no explica por qué: ¿Qué explica que no las estén utilizando?","Si responde en términos generales: Pensemos en la última actividad u oportunidad en la que no participaron. ¿Qué pasó?","Si no queda claro cuánto usan la red: ¿Cuál fue la última vez que alguien de la firma recurrió a ComplianceLatam y para qué?","Si no distingue qué tendría que cambiar: Para resolver eso, ¿qué necesitarían de ComplianceLatam y qué tendrían que ajustar ustedes?","Si considera que ya la aprovechan bien: ¿Qué les ha funcionado para mantener esa participación? ¿Hay algo que todavía quisieran aprovechar más?"],"titulo":"Uso y barreras"},{"descripcion":"Sobre el compromiso de una firma socia.","instrucciones":"Los aportes de contenido o iniciativas son un objetivo por cubrir. No los prioriza por encima de un asunto concreto que la persona acaba de mencionar.","maxSeguimientos":3,"preguntas":["¿Qué debería aportar una firma que pertenece a ComplianceLatam, y qué de eso está haciendo la suya hoy?"],"seguimientos":["Prioritario, si no menciona aportes para dar visibilidad a la firma: Durante el último año, ¿qué contenido o iniciativas han compartido para que se difundan a través de ComplianceLatam?","Si responde en términos generales: En la práctica, ¿qué debería aportar cualquier firma socia, incluso en un período de mucho trabajo?","Si no aterriza la respuesta a su firma: De eso que menciona, ¿qué están haciendo ustedes y qué les está costando sostener?","Si no concreta un compromiso posible: Pensando en los próximos tres meses, ¿qué podrían comprometerse a aportar y quién se encargaría?","Si no aborda el seguimiento de oportunidades: Cuando reciben un referido o hacen una conexión, ¿cómo podrían compartir qué pasó después sin que se vuelva una carga?"],"titulo":"Responsabilidades y compromiso"},{"descripcion":"Sobre la renovación de la membresía y su precio.","instrucciones":"Al cerrar esta última sección, después de la conversación, di: Gracias por compartir su experiencia con franqueza. Sus respuestas nos ayudarán a entender qué está aportando valor, qué dificulta la participación y qué cambios conviene priorizar para las firmas socias de ComplianceLatam.","maxSeguimientos":3,"preguntas":["Si hoy tuviera que defender el pago de la membresía frente a sus socios, ¿cuál sería su argumento más fuerte y dónde le costaría más convencerlos?"],"seguimientos":["Si no explica cómo se decide: ¿Quién tiene la última palabra sobre la renovación y qué pesa más para esa persona?","Si no identifica evidencia o materiales necesarios: ¿Qué le ayudaría a llegar mejor preparado a esa conversación: cifras, casos concretos, un resumen de resultados u otra cosa?","Si no menciona otras prioridades: ¿Con qué otras alianzas o gastos se compara la membresía cuando se discute el presupuesto?","Si no evalúa la cuota actual: Con lo que reciben hoy, ¿cómo sienten el monto que pagan? ¿Qué les hace verlo así?","Si no aborda el criterio para fijar tarifas: Si hubiera que definir las cuotas entre las firmas, ¿qué tendría sentido tener en cuenta para que fueran justas?"],"titulo":"Renovación y precio"}]$json$::jsonb;
  instrucciones text := $txt$Haz la pregunta principal y deja espacio para responder. Consérvala en usted, como está escrita. Si esta sección ya tiene respuestas, no vuelvas a hacer la pregunta principal aunque su redacción haya cambiado. Los seguimientos de la pauta son ejemplos, no preguntas literales. Formula como máximo tres por sección, solo los que aporten información que todavía no esté, a partir de lo que la persona acaba de contar y dentro del objetivo de la sección. No es obligatorio hacer los tres. Hazlos de a uno. Si un tema ya fue respondido, no lo vuelvas a preguntar. No presupongas hechos ni causas que no haya mencionado. No repitas su respuesta con fórmulas como «Entiendo, mencionó que…». Una aclaración o un «buena pregunta» no es información ni un seguimiento nuevo: reformula la misma pregunta de forma concreta para ayudar a responder. Si vuelve a no entender, simplifica y ofrece pasar al siguiente punto. Respeta un «no sé», la falta de experiencia y la voluntad de no profundizar. No insistas ni completes con suposiciones. No digas que ya tienes lo necesario solo porque se agotaron los seguimientos, la persona no sabe o no quiere seguir. En esos casos agradece y ofrece pasar al siguiente tema, sin inventar motivos, ejemplos ni conclusiones. Si hay información suficiente, puedes cerrar señalando en una frase lo recogido. Prioriza ejemplos de lo que ocurrió en la práctica. No presupongas falta de participación ni uso incorrecto. No interpretes la falta de mención como falta de uso o participación. Si un tema no se abordó, regístralo como “no explorado”. Conocimiento y participación son distintos: que nadie más participe no significa que nadie conozca la red. Distingue entre lo que la persona conoce directamente y lo que supone sobre otros integrantes de su firma.$txt$;
  plantillas integer;
BEGIN
  PERFORM set_config('app.interview_transition', 'allowed', true);

  UPDATE public.entrevista_plantilla AS p
  SET secciones = (
      SELECT jsonb_agg(
        (viejo.sv - 'descripcion' - 'instrucciones' - 'seguimientos' - 'preguntas' - 'titulo' - 'maxSeguimientos')
          || nuevo.sn
        ORDER BY i
      )
      FROM jsonb_array_elements(p.secciones) WITH ORDINALITY AS viejo(sv, i)
      JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
    ),
    instrucciones_agente = instrucciones,
    trato = 'usted'
  WHERE p.nombre = 'Entrevista a firmas socias — Fase 2'
    AND (
      jsonb_array_length(p.secciones) = jsonb_array_length(nuevas)
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p.secciones) WITH ORDINALITY AS viejo(sv, i)
        JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
        WHERE viejo.sv ->> 'titulo' IS DISTINCT FROM nuevo.sn ->> 'titulo'
      )
    );
  GET DIAGNOSTICS plantillas = ROW_COUNT;

  IF plantillas >= 1 THEN
  UPDATE public.entrevista AS e
  SET secciones = (
      SELECT jsonb_agg(
        (viejo.sv - 'descripcion' - 'instrucciones' - 'seguimientos' - 'preguntas' - 'titulo' - 'maxSeguimientos')
          || nuevo.sn
        ORDER BY i
      )
      FROM jsonb_array_elements(e.secciones) WITH ORDINALITY AS viejo(sv, i)
      JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
    ),
    instrucciones_agente = instrucciones,
    trato = 'usted'
  WHERE e.plantilla_id IN (
      SELECT p.id
      FROM public.entrevista_plantilla AS p
      WHERE p.nombre = 'Entrevista a firmas socias — Fase 2'
    )
    AND e.estado = 'abierta'
    AND e.flujo_estado IN ('bienvenida', 'presentacion', 'chat')
    AND (
      jsonb_array_length(e.secciones) = jsonb_array_length(nuevas)
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(e.secciones) WITH ORDINALITY AS viejo(sv, i)
        JOIN jsonb_array_elements(nuevas) WITH ORDINALITY AS nuevo(sn, i) USING (i)
        WHERE viejo.sv ->> 'titulo' IS DISTINCT FROM nuevo.sn ->> 'titulo'
      )
    );
  END IF;
END
$profundidad$;