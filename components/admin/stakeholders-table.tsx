"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DescargarTranscripcionButton } from "@/components/admin/descargar-transcripcion-button";
import { EntrarComoStakeholderButton } from "@/components/admin/entrar-como-stakeholder-button";
import { EnviarNotionTranscripcionButton } from "@/components/admin/enviar-notion-transcripcion-button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  agruparPersonasPorAcceso,
  resumenCantidad,
} from "@/lib/consultoria/personas-grupos";
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

function PersonasGrupo({
  children,
  defaultOpen,
  resumen,
  titulo,
}: {
  children: ReactNode;
  defaultOpen: boolean;
  resumen: string;
  titulo: string;
}) {
  return (
    <Collapsible
      className="flex flex-col overflow-hidden rounded-lg border border-border"
      defaultOpen={defaultOpen}
    >
      <h3 className="m-0 font-medium text-sm">
        <CollapsibleTrigger
          className="group flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
          type="button"
        >
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
          <span className="min-w-0 flex-1">{titulo}</span>
          <span className="shrink-0 font-normal text-muted-foreground text-xs">
            {resumen}
          </span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent className="border-border border-t">
        <div className="px-1 py-1">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function StakeholdersTable({
  emptyMessage,
  proyectoId,
  stakeholders,
}: {
  emptyMessage?: string;
  proyectoId: string;
  stakeholders: StakeholderAdmin[];
}) {
  if (stakeholders.length === 0) {
    return (
      <p className="px-3 py-2 text-muted-foreground text-sm">
        {emptyMessage ??
          "Todavía no hay personas en este proyecto. Agrégalas abajo o envíales una entrevista agéntica."}
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

export function PersonasPorAcceso({
  proyectoId,
  stakeholders,
}: {
  proyectoId: string;
  stakeholders: StakeholderAdmin[];
}) {
  if (stakeholders.length === 0) {
    return <StakeholdersTable proyectoId={proyectoId} stakeholders={[]} />;
  }

  const grupos = agruparPersonasPorAcceso(stakeholders);

  return (
    <div className="flex flex-col gap-3">
      <PersonasGrupo
        defaultOpen={grupos.clientes.length > 0}
        resumen={resumenCantidad(grupos.clientes.length, "cliente", "clientes")}
        titulo="Clientes"
      >
        <StakeholdersTable
          emptyMessage="Todavía no hay clientes en este proyecto."
          proyectoId={proyectoId}
          stakeholders={grupos.clientes}
        />
      </PersonasGrupo>
      <PersonasGrupo
        defaultOpen={grupos.stakeholders.length > 0}
        resumen={resumenCantidad(
          grupos.stakeholders.length,
          "stakeholder",
          "stakeholders"
        )}
        titulo="Stakeholders"
      >
        <StakeholdersTable
          emptyMessage="Todavía no hay stakeholders en este proyecto."
          proyectoId={proyectoId}
          stakeholders={grupos.stakeholders}
        />
      </PersonasGrupo>
    </div>
  );
}
