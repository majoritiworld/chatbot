"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { type AuthActionState, iniciarSesionAdmin } from "@/app/(auth)/actions";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = { status: "idle" };

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(
    iniciarSesionAdmin,
    initialState
  );

  const error =
    state.status === "failed" || state.status === "invalid_data"
      ? state.message
      : null;

  return (
    <>
      <div className="flex flex-col gap-6">
        <Image
          alt="Majoriti"
          className="h-auto w-full max-w-[280px] object-contain object-left dark:invert"
          height={156}
          priority
          src="/images/majoriti-logo.png"
          width={1024}
        />
        <div className="flex flex-col gap-2">
          <h1 className="font-semibold text-2xl tracking-tight">
            Acceso Majoriti
          </h1>
          <p className="text-muted-foreground text-sm">
            Entra al admin con tu correo y contraseña. El código por email es
            solo para el portal del cliente.
          </p>
        </div>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="font-normal text-muted-foreground" htmlFor="email">
            Email
          </Label>
          <Input
            autoComplete="username"
            autoFocus
            className="h-10 rounded-lg border-border/50 bg-muted/50 text-sm"
            defaultValue={state.email ?? ""}
            id="email"
            name="email"
            placeholder="hello@majoriti.world"
            required
            type="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label
            className="font-normal text-muted-foreground"
            htmlFor="password"
          >
            Contraseña
          </Label>
          <Input
            autoComplete="current-password"
            className="h-10 rounded-lg border-border/50 bg-muted/50 text-sm"
            id="password"
            name="password"
            required
            type="password"
          />
        </div>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        <Button className="relative" disabled={pending} type="submit">
          Entrar al admin
          {pending ? (
            <span className="absolute right-4 animate-spin">
              <LoaderIcon />
            </span>
          ) : null}
        </Button>
      </form>

      <Link
        className="text-[13px] text-muted-foreground underline-offset-4 hover:underline"
        href="/login"
      >
        Acceso del cliente con código
      </Link>
    </>
  );
}
