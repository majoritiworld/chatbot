"use client";

import { useActionState } from "react";
import {
  type EnlaceAbiertoState,
  empezarEntrevistaAbierta,
} from "@/app/[slug]/abierta/[token]/actions";
import { CerrarSesionButton } from "@/components/auth/cerrar-sesion-button";
import { Aviso, Cabecera } from "@/components/auth/login-form";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MarcaPublica } from "@/lib/consultoria/marca";

const initialState: EnlaceAbiertoState = {};

const CLASE_INPUT = "h-10 rounded-lg border-border/50 bg-muted/50 text-sm";

function Campo({
  autoComplete,
  error,
  etiqueta,
  name,
  placeholder,
  type = "text",
  valor,
}: {
  autoComplete: string;
  error?: string;
  etiqueta: string;
  name: string;
  placeholder: string;
  type?: "email" | "text";
  valor?: string;
}) {
  const idError = `${name}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label className="font-normal text-muted-foreground" htmlFor={name}>
        {etiqueta}
      </Label>
      <Input
        aria-describedby={error ? idError : undefined}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        className={CLASE_INPUT}
        defaultValue={valor}
        id={name}
        name={name}
        placeholder={placeholder}
        required
        type={type}
      />
      {error ? (
        <p className="text-destructive text-sm" id={idError}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Anyone with the link: a few details, then a new interview of the phase. */
export function FormularioEnlaceAbierto({
  enlace,
  marca,
  proyectoSlug,
}: {
  enlace: string;
  marca: MarcaPublica;
  proyectoSlug: string;
}) {
  const [state, action, pending] = useActionState(
    empezarEntrevistaAbierta,
    initialState
  );

  return (
    <>
      <Cabecera marca={marca}>
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            {marca.titulo}
          </h1>
          <p className="text-muted-foreground text-sm">
            Antes de empezar, cuéntenos quién es. Después pasará directo a la
            entrevista.
          </p>
        </div>
      </Cabecera>

      <form action={action} className="flex flex-col gap-4">
        <input name="proyecto" type="hidden" value={proyectoSlug} />
        <input name="enlace" type="hidden" value={enlace} />
        <div hidden>
          <label htmlFor="sitio">Sitio web</label>
          <input autoComplete="off" id="sitio" name="sitio" tabIndex={-1} />
        </div>

        <Campo
          autoComplete="name"
          error={state.errores?.nombre}
          etiqueta="Nombre"
          name="nombre"
          placeholder="Nombre y apellido"
          valor={state.valores?.nombre}
        />
        <Campo
          autoComplete="email"
          error={state.errores?.email}
          etiqueta="Correo electrónico"
          name="email"
          placeholder="nombre@empresa.com"
          type="email"
          valor={state.valores?.email}
        />
        <Campo
          autoComplete="organization"
          error={state.errores?.empresa}
          etiqueta="Empresa"
          name="empresa"
          placeholder="Nombre de su empresa"
          valor={state.valores?.empresa}
        />

        {state.mensaje ? <Aviso mensaje={state.mensaje} tono="error" /> : null}

        <Button className="relative" disabled={pending} type="submit">
          Comenzar la entrevista
          {pending ? (
            <span className="absolute right-4 animate-spin">
              <LoaderIcon />
            </span>
          ) : null}
        </Button>
      </form>

      {state.sesionAjena ? <CerrarSesionButton variant="outline" /> : null}
    </>
  );
}
