import type {
  FlujoEntrevista,
  SeccionCompletada,
  SeccionEntrevista,
} from "@/lib/consultoria/entrevista-contenido";

export type UserRole = "majoriti" | "cliente" | "stakeholder" | "comite";

export type Usuario = {
  id: string;
  nombre: string | null;
  email: string;
  rol: UserRole;
  proyecto_id: string | null;
};

export type Fase = {
  id: string;
  nombre: string;
  orden: number;
  estado: string;
  fecha_estimada: string | null;
  fecha_cierre: string | null;
  descripcion: string | null;
};

export type Tarea = {
  id: string;
  fase_id: string;
  nombre: string | null;
  responsable: string | null;
  stakeholder_id: string | null;
  estado: string;
  tipo: string;
  entrevista_id: string | null;
  fecha_limite: string | null;
};

export type Evento = {
  id: string;
  proyecto_id: string;
  titulo: string;
  fecha: string;
  participantes: string[];
  minuta: string | null;
  google_event_id: string | null;
  granola_note_id: string | null;
  created_at: string;
};

export type Entrevista = {
  id: string;
  stakeholder_id: string;
  preguntas: string[];
  secciones: SeccionEntrevista[];
  flujo_estado: FlujoEntrevista;
  seccion_actual: number;
  secciones_completadas: SeccionCompletada[];
  estado: string;
  fecha_completada: string | null;
  consentimiento_en: string | null;
  correo_agradecimiento_en: string | null;
  notion_transcripcion_id: string | null;
  transcripcion?: unknown;
  resumen?: unknown;
  ultima_actividad?: string | null;
  /** Populated when resolving for the interview chat prompt. */
  stakeholder_nombre?: string | null;
  stakeholder_firma?: string | null;
  stakeholder_email?: string | null;
  proyecto_cliente?: string | null;
};
