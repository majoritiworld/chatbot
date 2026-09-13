"use client";

import { useActionState } from "react";
import {
  type ActionState,
  subirDocumento,
} from "@/app/(admin)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DocumentoAdmin,
  FaseAdmin,
} from "@/lib/consultoria/stakeholders";

const initialState: ActionState = { status: "idle" };

export function DocumentoUploadForm({
  stakeholderId,
  proyectoId,
  fases,
  faseDefaultId,
  documentos,
}: {
  stakeholderId: string;
  proyectoId: string;
  fases: FaseAdmin[];
  faseDefaultId: string | null;
  documentos: DocumentoAdmin[];
}) {
  const [state, formAction, pending] = useActionState(
    subirDocumento,
    initialState
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        action={formAction}
        className="flex flex-col gap-4 rounded-xl border border-border p-4"
        encType="multipart/form-data"
      >
        <input name="stakeholderId" type="hidden" value={stakeholderId} />
        <input name="proyectoId" type="hidden" value={proyectoId} />

        <div>
          <h2 className="font-medium text-base">Documento de fase</h2>
          <p className="text-muted-foreground text-sm">
            Sube un archivo a Storage o pega un link externo.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <Input
              defaultValue="informe"
              id="tipo"
              name="tipo"
              placeholder="informe, brief…"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="faseId">Fase</Label>
            <select
              className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
              defaultValue={faseDefaultId ?? ""}
              id="faseId"
              name="faseId"
            >
              <option value="">Sin fase</option>
              {fases.map((fase) => (
                <option key={fase.id} value={fase.id}>
                  {fase.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre (opcional)</Label>
            <Input id="nombre" name="nombre" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="link">Link externo</Label>
            <Input
              id="link"
              name="link"
              placeholder="https://…"
              type="url"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="archivo">Archivo</Label>
            <Input id="archivo" name="archivo" type="file" />
          </div>
        </div>

        {state.message ? (
          <p
            className={
              state.status === "error"
                ? "text-destructive text-sm"
                : "text-muted-foreground text-sm"
            }
          >
            {state.message}
          </p>
        ) : null}

        <Button className="w-fit" disabled={pending} type="submit">
          {pending ? "Subiendo…" : "Asociar documento"}
        </Button>
      </form>

      {documentos.length > 0 ? (
        <ul className="flex flex-col gap-2 rounded-xl border border-border p-4 text-sm">
          {documentos.map((doc) => {
            const esStorage = !doc.link.startsWith("http");
            const fase = fases.find((item) => item.id === doc.faseId);
            return (
              <li className="flex flex-col gap-0.5" key={doc.id}>
                <span className="font-medium">
                  {doc.nombre ?? doc.tipo}
                  {fase ? ` · ${fase.nombre}` : ""}
                </span>
                {esStorage ? (
                  <span className="text-muted-foreground text-xs">
                    Storage: {doc.link}
                  </span>
                ) : (
                  <a
                    className="text-primary text-xs hover:underline"
                    href={doc.link}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {doc.link}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
