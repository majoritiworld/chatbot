"use client";

import Link from "next/link";
import { DescargarTranscripcionButton } from "@/components/admin/descargar-transcripcion-button";
import { EntrarComoStakeholderButton } from "@/components/admin/entrar-como-stakeholder-button";
import { EnviarNotionTranscripcionButton } from "@/components/admin/enviar-notion-transcripcion-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { StakeholderAdmin } from "@/lib/consultoria/stakeholders";
import { cn } from "@/lib/utils";

const ETIQUETA_ESTADO: Record<string, string> = {
  abierta: "Abierta",
  completada: "Completada",
  en_curso: "En curso",
  pendiente: "Pendiente",
};

function formatActividad(value: string | null) {
  if (!value) {
    return "Sin actividad";
  }

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badgeVariant(estado: string) {
  if (estado === "completada") {
    return "secondary" as const;
  }
  if (estado === "pendiente") {
    return "outline" as const;
  }
  return "default" as const;
}

function etiquetaAcceso(rol: StakeholderAdmin["rolPortal"]) {
  if (rol === "cliente") {
    return "Cliente";
  }
  if (rol === "stakeholder") {
    return "Stakeholder";
  }
  return "Sin cuenta";
}

export function StakeholdersTable({
  stakeholders,
  proyectoId,
}: {
  stakeholders: StakeholderAdmin[];
  proyectoId: string;
}) {
  if (stakeholders.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Todavía no hay personas en este proyecto. Agrégalas abajo o envíales una
        entrevista agéntica.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Firma</TableHead>
          <TableHead>Acceso</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Última actividad</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {stakeholders.map((row) => (
          <TableRow
            className={cn(
              row.alerta === "inactivo" && "bg-destructive/10",
              row.alerta === "sin_actividad" && "bg-orange-500/10"
            )}
            key={row.id}
          >
            <TableCell>
              <Link
                className="font-medium hover:underline"
                href={`/admin/${proyectoId}/stakeholder/${row.id}`}
              >
                {row.nombreCompleto}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {row.firma ?? "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant={row.rolPortal === "cliente" ? "default" : "outline"}
              >
                {etiquetaAcceso(row.rolPortal)}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={badgeVariant(row.estadoEntrevista)}>
                {ETIQUETA_ESTADO[row.estadoEntrevista] ?? row.estadoEntrevista}
              </Badge>
            </TableCell>
            <TableCell
              className={cn(
                "text-muted-foreground",
                row.alerta !== "ok" && "font-medium text-foreground"
              )}
            >
              {formatActividad(row.ultimaActividad)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <EntrarComoStakeholderButton stakeholderId={row.id} />
                <DescargarTranscripcionButton
                  completada={row.estadoEntrevista === "completada"}
                  stakeholderId={row.id}
                />
                <EnviarNotionTranscripcionButton
                  completada={row.estadoEntrevista === "completada"}
                  notionPageId={row.notionTranscripcionId}
                  stakeholderId={row.id}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
