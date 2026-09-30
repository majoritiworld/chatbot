"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type EntradaCorreoState, entrarConCorreo } from "@/app/(auth)/actions";
import { CerrarSesionButton } from "@/components/auth/cerrar-sesion-button";
import { Aviso, Cabecera } from "@/components/auth/login-form";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type MarcaPublica,
  textoAccesoInvitacion,
} from "@/lib/consultoria/marca";

const initialState: EntradaCorreoState = {};

/** Email-only entry. The server decides which assignment, if any, it opens. */
export function EntradaSoloCorreo({
  marca,
  proyectoSlug,
}: {
  marca: MarcaPublica;
  proyectoSlug: string;
}) {
  const [state, action, pending] = useActionState(
    entrarConCorreo,
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
            Escriba el correo electrónico al que recibió la invitación para
            entrar a su entrevista.
          </p>
        </div>
      </Cabecera>

      <form action={action} className="flex flex-col gap-4">
        <input name="proyecto" type="hidden" value={proyectoSlug} />
        <div className="flex flex-col gap-2">
          <Label className="font-normal text-muted-foreground" htmlFor="email">
            Correo electrónico
          </Label>
          <Input
            autoComplete="email"
            autoFocus
            className="h-10 rounded-lg border-border/50 bg-muted/50 text-sm"
            defaultValue={state.email}
            id="email"
            name="email"
            placeholder="nombre@empresa.com"
            required
            type="email"
          />
        </div>

        {state.message ? <Aviso mensaje={state.message} tono="error" /> : null}

        <Button className="relative" disabled={pending} type="submit">
          Entrar a mi entrevista
          {pending ? (
            <span className="absolute right-4 animate-spin">
              <LoaderIcon />
            </span>
          ) : null}
        </Button>
      </form>

      {state.sesionAjena ? <CerrarSesionButton variant="outline" /> : null}

      <Link
        className="text-[13px] text-muted-foreground underline-offset-4 hover:underline"
        href={`/${proyectoSlug}?codigo=1`}
      >
        Entrar con correo y código de verificación
      </Link>

      <p className="text-[13px] text-muted-foreground">
        {textoAccesoInvitacion(marca)}
      </p>
    </>
  );
}
