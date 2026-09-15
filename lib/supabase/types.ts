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
  transcripcion?: unknown;
  resumen?: unknown;
  ultima_actividad?: string | null;
  /** Populated when resolving for the interview chat prompt. */
  stakeholder_nombre?: string | null;
  stakeholder_firma?: string | null;
  stakeholder_email?: string | null;
};
